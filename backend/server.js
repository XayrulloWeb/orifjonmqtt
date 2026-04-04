require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const net = require('net');
const http = require('http');

const mqtt = require('mqtt');
const { Server } = require('socket.io');
const { Aedes } = require('aedes');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const HTTP_PORT = Number(process.env.PORT || 4000);
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const AUTO_OFF_HYSTERESIS = Number(process.env.AUTO_OFF_HYSTERESIS || 5);
const AUTO_ON_COOLDOWN_MS = Number(process.env.AUTO_ON_COOLDOWN_MS || 30000);
const AUTO_MAX_ON_MS = Number(process.env.AUTO_MAX_ON_MS || 120000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

let aedes;
let mqttClient;
let pumpState = 'OFF';
let lastAutoOnAt = 0;
let autoOffTimer = null;

function clearAutoOffTimer() {
  if (!autoOffTimer) {
    return;
  }

  clearTimeout(autoOffTimer);
  autoOffTimer = null;
}

async function getDevice() {
  let device = await prisma.device.findFirst();

  if (!device) {
    device = await prisma.device.create({
      data: {
        deviceIdStr: 'default-device',
      },
    });
  }

  return device;
}

async function getDashboardPayload() {
  const device = await getDevice();

  const [data, logs] = await Promise.all([
    prisma.sensorData.findMany({
      where: { deviceId: device.id },
      take: 10,
      orderBy: { id: 'desc' },
    }),
    prisma.pumpLog.findMany({
      where: { deviceId: device.id },
      take: 10,
      orderBy: { id: 'desc' },
    }),
  ]);

  return {
    data,
    logs,
    settings: {
      isAutoMode: device.isAutoMode,
      moistureThreshold: device.moistureThreshold,
    },
    pumpState,
  };
}

async function emitDashboardUpdate() {
  try {
    const payload = await getDashboardPayload();
    io.emit('dashboard:update', payload);
  } catch (error) {
    console.error('Failed to emit dashboard update:', error);
  }
}

function scheduleAutoOff(deviceId) {
  clearAutoOffTimer();

  autoOffTimer = setTimeout(async () => {
    if (pumpState !== 'ON') {
      return;
    }

    try {
      await publishPumpAction({
        action: 'OFF',
        mode: 'AUTO',
        deviceId,
        reason: 'max_on_timeout',
      });

      await emitDashboardUpdate();
    } catch (error) {
      console.error('AUTO OFF timeout error:', error);
    }
  }, AUTO_MAX_ON_MS);
}

async function initializePumpState() {
  const latestLog = await prisma.pumpLog.findFirst({
    orderBy: { id: 'desc' },
  });

  if (latestLog?.action === 'ON' || latestLog?.action === 'OFF') {
    pumpState = latestLog.action;
  }
}

async function publishPumpAction({ action, mode, deviceId, reason }) {
  if (!mqttClient) {
    throw new Error('MQTT client is not initialized');
  }

  if (action === pumpState) {
    return false;
  }

  mqttClient.publish('smart_watering/pump', action);

  await prisma.pumpLog.create({
    data: {
      action,
      mode,
      deviceId,
    },
  });

  pumpState = action;

  if (mode === 'AUTO' && action === 'ON') {
    lastAutoOnAt = Date.now();
    scheduleAutoOff(deviceId);
  }

  if (action === 'OFF') {
    clearAutoOffTimer();
  }

  console.log(`Pump ${action} (${mode})${reason ? ` - ${reason}` : ''}`);
  return true;
}

async function handleMoistureMessage(topic, message) {
  if (topic !== 'smart_watering/moisture') {
    return;
  }

  const moisture = Number.parseInt(message.toString(), 10);
  if (Number.isNaN(moisture)) {
    return;
  }

  try {
    const device = await getDevice();

    await Promise.all([
      prisma.sensorData.create({
        data: {
          moisture,
          deviceId: device.id,
        },
      }),
      prisma.device.update({
        where: { id: device.id },
        data: {
          lastSeen: new Date(),
          lastMoisture: moisture,
        },
      }),
    ]);

    if (device.isAutoMode) {
      const shouldTurnOn = moisture < device.moistureThreshold;
      const shouldTurnOff = moisture >= device.moistureThreshold + AUTO_OFF_HYSTERESIS;
      const cooldownPassed = Date.now() - lastAutoOnAt >= AUTO_ON_COOLDOWN_MS;

      if (shouldTurnOn && pumpState !== 'ON' && cooldownPassed) {
        await publishPumpAction({
          action: 'ON',
          mode: 'AUTO',
          deviceId: device.id,
          reason: 'below_threshold',
        });
      }

      if (shouldTurnOff && pumpState === 'ON') {
        await publishPumpAction({
          action: 'OFF',
          mode: 'AUTO',
          deviceId: device.id,
          reason: 'threshold_recovered',
        });
      }
    }

    await emitDashboardUpdate();
  } catch (error) {
    console.error('MQTT message handler error:', error);
  }
}

app.get('/api/data', async (req, res) => {
  try {
    const payload = await getDashboardPayload();
    res.json(payload.data);
  } catch (error) {
    console.error('/api/data error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const payload = await getDashboardPayload();
    res.json(payload.settings);
  } catch (error) {
    console.error('/api/settings GET error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { moistureThreshold, isAutoMode } = req.body;
    const device = await getDevice();

    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: {
        moistureThreshold,
        isAutoMode,
      },
    });

    if (!updatedDevice.isAutoMode && pumpState === 'ON') {
      clearAutoOffTimer();
    }

    await emitDashboardUpdate();

    res.json({
      isAutoMode: updatedDevice.isAutoMode,
      moistureThreshold: updatedDevice.moistureThreshold,
    });
  } catch (error) {
    console.error('/api/settings POST error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const payload = await getDashboardPayload();
    res.json(payload.logs);
  } catch (error) {
    console.error('/api/logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.post('/api/pump', async (req, res) => {
  try {
    const { action } = req.body;

    if (action !== 'ON' && action !== 'OFF') {
      return res.status(400).json({ error: 'Action must be ON or OFF' });
    }

    const device = await getDevice();

    if (action === pumpState) {
      return res.json({ success: true, action, noop: true });
    }

    await publishPumpAction({
      action,
      mode: 'MANUAL',
      deviceId: device.id,
      reason: 'api_request',
    });

    await emitDashboardUpdate();

    res.json({ success: true, action });
  } catch (error) {
    console.error('/api/pump error:', error);
    res.status(500).json({ error: 'Failed to control pump' });
  }
});

const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

async function setupMqtt() {
  aedes = await Aedes.createBroker();

  const mqttServer = net.createServer(aedes.handle);

  await new Promise((resolve, reject) => {
    mqttServer.once('error', reject);
    mqttServer.listen(MQTT_PORT, '0.0.0.0', resolve);
  });

  mqttServer.on('error', (error) => {
    console.error('MQTT server error:', error);
  });

  console.log(`MQTT broker is running on port ${MQTT_PORT}`);

  mqttClient = mqtt.connect(`mqtt://localhost:${MQTT_PORT}`);

  mqttClient.on('connect', () => {
    console.log('Internal MQTT client connected');
    mqttClient.subscribe('smart_watering/moisture', (error) => {
      if (error) {
        console.error('Failed to subscribe smart_watering/moisture:', error);
      }
    });
  });

  mqttClient.on('error', (error) => {
    console.error('MQTT client error:', error);
  });

  mqttClient.on('message', (topic, message) => {
    void handleMoistureMessage(topic, message);
  });
}

async function startServer() {
  try {
    await initializePumpState();
    await setupMqtt();

    io.on('connection', async (socket) => {
      try {
        socket.emit('dashboard:update', await getDashboardPayload());
      } catch (error) {
        console.error('Socket init payload error:', error);
      }
    });

    httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
      console.log(`HTTP server is running on http://0.0.0.0:${HTTP_PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

startServer();
