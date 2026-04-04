require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();

app.use(cors());
app.use(express.json());

async function getDevice() {
  let device = await prisma.device.findFirst();

  if (!device) {
    device = await prisma.device.create({
      data: { deviceIdStr: 'default-device' },
    });
  }

  return device;
}

const MQTT_BROKER = 'mqtt://test.mosquitto.org';
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log('MQTT connected');
  mqttClient.subscribe('smart_watering/moisture');
});

mqttClient.on('message', async (topic, message) => {
  if (topic !== 'smart_watering/moisture') {
    return;
  }

  const moisture = Number.parseInt(message.toString(), 10);
  if (Number.isNaN(moisture)) {
    return;
  }

  try {
    const device = await getDevice();

    await prisma.sensorData.create({
      data: {
        moisture,
        deviceId: device.id,
      },
    });

    if (device.isAutoMode && moisture < device.moistureThreshold) {
      mqttClient.publish('smart_watering/pump', 'ON');

      await prisma.pumpLog.create({
        data: {
          action: 'ON',
          mode: 'AUTO',
          deviceId: device.id,
        },
      });
    }
  } catch (error) {
    console.error('MQTT handler error:', error);
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const device = await getDevice();
    const data = await prisma.sensorData.findMany({
      where: { deviceId: device.id },
      take: 10,
      orderBy: { id: 'desc' },
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const device = await getDevice();
    res.json({
      isAutoMode: device.isAutoMode,
      moistureThreshold: device.moistureThreshold,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { moistureThreshold, isAutoMode } = req.body;
    const device = await getDevice();

    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: { moistureThreshold, isAutoMode },
    });

    res.json({
      isAutoMode: updatedDevice.isAutoMode,
      moistureThreshold: updatedDevice.moistureThreshold,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const device = await getDevice();
    const logs = await prisma.pumpLog.findMany({
      where: { deviceId: device.id },
      take: 10,
      orderBy: { id: 'desc' },
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.post('/api/pump', async (req, res) => {
  try {
    const { action } = req.body;
    const device = await getDevice();

    mqttClient.publish('smart_watering/pump', action);

    await prisma.pumpLog.create({
      data: {
        action,
        mode: 'MANUAL',
        deviceId: device.id,
      },
    });

    res.json({ success: true, action });
  } catch (error) {
    res.status(500).json({ error: 'Failed to control pump' });
  }
});

setInterval(() => {
  const fakeMoisture = Math.floor(Math.random() * 50) + 20;
  mqttClient.publish('smart_watering/moisture', String(fakeMoisture));
}, 5000);

app.listen(3000, () => {
  console.log('Backend started on http://localhost:3000');
});
