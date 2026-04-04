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
const MIN_MOISTURE = 0;
const MAX_MOISTURE = 100;
const MIN_THRESHOLD = 10;
const MAX_THRESHOLD = 90;
const PUMP_ACTIONS = new Set(['ON', 'OFF']);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
let autoOffTimer = null;

function clearAutoOffTimer() {
  if (autoOffTimer) {
    clearTimeout(autoOffTimer);
    autoOffTimer = null;
  }
}

function validateSettingsPayload(body) {
  if (!body || typeof body !== 'object') {
    return 'Request body is required';
  }

  if (typeof body.isAutoMode !== 'boolean') {
    return 'isAutoMode must be a boolean';
  }

  if (typeof body.moistureThreshold !== 'number' || !Number.isFinite(body.moistureThreshold)) {
    return 'moistureThreshold must be a number';
  }

  if (!Number.isInteger(body.moistureThreshold)) {
    return 'moistureThreshold must be an integer';
  }

  if (body.moistureThreshold < MIN_THRESHOLD || body.moistureThreshold > MAX_THRESHOLD) {
    return `moistureThreshold must be in range ${MIN_THRESHOLD}..${MAX_THRESHOLD}`;
  }

  return null;
}

function isValidMoisture(moisture) {
  return Number.isInteger(moisture) && moisture >= MIN_MOISTURE && moisture <= MAX_MOISTURE;
}

function publishToMqtt(topic, payload) {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !mqttClient.connected) {
      reject(new Error('MQTT client is not connected'));
      return;
    }

    mqttClient.publish(topic, payload, { qos: 1 }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
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
      pumpState: device.pumpState,
      pumpUpdatedAt: device.pumpUpdatedAt,
      lastCommandReason: device.lastCommandReason,
    },
    pumpState: device.pumpState,
  };
}

async function emitDashboardUpdate() {
  try {
    io.emit('dashboard:update', await getDashboardPayload());
  } catch (error) {
    console.error('Failed to emit dashboard update:', error);
  }
}

async function enforceTimedAutoOff(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.pumpState !== 'ON') {
    return;
  }

  await publishPumpAction({
    action: 'OFF',
    mode: 'SYSTEM',
    deviceId,
    reason: 'max_on_timeout',
  });

  await emitDashboardUpdate();
}

function scheduleAutoOff(deviceId, delayMs = AUTO_MAX_ON_MS) {
  clearAutoOffTimer();

  autoOffTimer = setTimeout(() => {
    void enforceTimedAutoOff(deviceId).catch((error) => {
      console.error('Timed auto OFF error:', error);
    });
  }, Math.max(0, delayMs));
}

async function restoreAutoOffIfNeeded() {
  const device = await getDevice();

  if (device.pumpState !== 'ON') {
    return;
  }

  if (!device.pumpUpdatedAt) {
    scheduleAutoOff(device.id);
    return;
  }

  const elapsed = Date.now() - new Date(device.pumpUpdatedAt).getTime();
  const remaining = AUTO_MAX_ON_MS - elapsed;

  if (remaining <= 0) {
    await enforceTimedAutoOff(device.id);
    return;
  }

  scheduleAutoOff(device.id, remaining);
}

async function publishPumpAction({ action, mode, deviceId, reason }) {
  if (!PUMP_ACTIONS.has(action)) {
    throw new Error('Invalid pump action');
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    throw new Error('Device not found');
  }

  if (device.pumpState === action) {
    return { changed: false, device };
  }

  await publishToMqtt('smart_watering/pump', action);

  const now = new Date();
  const [_, updatedDevice] = await prisma.$transaction([
    prisma.pumpLog.create({
      data: {
        action,
        mode,
        deviceId,
      },
    }),
    prisma.device.update({
      where: { id: deviceId },
      data: {
        pumpState: action,
        pumpUpdatedAt: now,
        lastCommandReason: reason || null,
      },
    }),
  ]);

  if (action === 'ON') {
    scheduleAutoOff(deviceId);
  } else {
    clearAutoOffTimer();
  }

  console.log(`Pump ${action} (${mode})${reason ? ` - ${reason}` : ''}`);
  return { changed: true, device: updatedDevice };
}

async function canAutoTurnOn(deviceId) {
  const lastAutoOn = await prisma.pumpLog.findFirst({
    where: {
      deviceId,
      mode: 'AUTO',
      action: 'ON',
    },
    orderBy: { id: 'desc' },
  });

  if (!lastAutoOn) {
    return true;
  }

  const elapsed = Date.now() - new Date(lastAutoOn.createdAt).getTime();
  return elapsed >= AUTO_ON_COOLDOWN_MS;
}

async function handleMoistureMessage(topic, message) {
  if (topic !== 'smart_watering/moisture') {
    return;
  }

  const moisture = Number.parseInt(message.toString(), 10);

  if (!isValidMoisture(moisture)) {
    console.warn(`Ignored moisture value out of range: ${message.toString()}`);
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

      if (shouldTurnOn && device.pumpState !== 'ON' && (await canAutoTurnOn(device.id))) {
        await publishPumpAction({
          action: 'ON',
          mode: 'AUTO',
          deviceId: device.id,
          reason: 'below_threshold',
        });
      }

      if (shouldTurnOff && device.pumpState === 'ON') {
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
    res.json((await getDashboardPayload()).data);
  } catch (error) {
    console.error('/api/data error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    res.json((await getDashboardPayload()).settings);
  } catch (error) {
    console.error('/api/settings GET error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const validationError = validateSettingsPayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const device = await getDevice();

    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: {
        moistureThreshold: req.body.moistureThreshold,
        isAutoMode: req.body.isAutoMode,
      },
    });

    if (device.isAutoMode && !updatedDevice.isAutoMode && updatedDevice.pumpState === 'ON') {
      await publishPumpAction({
        action: 'OFF',
        mode: 'SYSTEM',
        deviceId: updatedDevice.id,
        reason: 'auto_mode_disabled',
      });
    }

    await emitDashboardUpdate();

    const fresh = await prisma.device.findUnique({ where: { id: updatedDevice.id } });
    res.json({
      isAutoMode: fresh.isAutoMode,
      moistureThreshold: fresh.moistureThreshold,
      pumpState: fresh.pumpState,
      pumpUpdatedAt: fresh.pumpUpdatedAt,
      lastCommandReason: fresh.lastCommandReason,
    });
  } catch (error) {
    console.error('/api/settings POST error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    res.json((await getDashboardPayload()).logs);
  } catch (error) {
    console.error('/api/logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.post('/api/pump', async (req, res) => {
  try {
    const { action } = req.body || {};

    if (!PUMP_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'Action must be ON or OFF' });
    }

    const device = await getDevice();

    if (device.isAutoMode) {
      return res.status(409).json({ error: 'Disable auto mode before manual control' });
    }

    if (action === device.pumpState) {
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
    await getDevice();
    await setupMqtt();
    await restoreAutoOffIfNeeded();

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
