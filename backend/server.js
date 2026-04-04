require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const net = require('net');

const mqtt = require('mqtt');
const { Aedes } = require('aedes');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// --- НАСТРОЙКА БАЗЫ ДАННЫХ ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
app.use(express.json());

// Получаем или создаем устройство
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

// --- ОСНОВНАЯ ФУНКЦИЯ ЗАПУСКА СЕРВЕРА ---
async function startServer() {
  try {
    // 1. Создаем MQTT брокер
    const aedes = await Aedes.createBroker();

    // 2. Поднимаем TCP сервер для MQTT
    const mqttServer = net.createServer(aedes.handle);
    const MQTT_PORT = 1883;

    mqttServer.listen(MQTT_PORT, () => {
      console.log(`MQTT Брокер успешно запущен на порту ${MQTT_PORT}`);
    });

    mqttServer.on('error', (error) => {
      console.error('Ошибка MQTT сервера:', error);
    });

    // 3. Подключаем внутреннего клиента к нашему брокеру
    const mqttClient = mqtt.connect(`mqtt://localhost:${MQTT_PORT}`);

    mqttClient.on('connect', () => {
      console.log('Внутренний MQTT клиент подключен');
      mqttClient.subscribe('smart_watering/moisture', (err) => {
        if (err) {
          console.error('Ошибка подписки на smart_watering/moisture:', err);
        } else {
          console.log('Подписка на smart_watering/moisture успешна');
        }
      });
    });

    mqttClient.on('error', (error) => {
      console.error('Ошибка MQTT клиента:', error);
    });

    // 4. Обработка входящих MQTT сообщений
    mqttClient.on('message', async (topic, message) => {
      if (topic !== 'smart_watering/moisture') return;

      const moisture = Number.parseInt(message.toString(), 10);
      if (Number.isNaN(moisture)) return;

      try {
        const device = await getDevice();

        await prisma.sensorData.create({
          data: {
            moisture,
            deviceId: device.id,
          },
        });

        console.log(`Получена влажность: ${moisture}`);

        if (device.isAutoMode && moisture < device.moistureThreshold) {
          mqttClient.publish('smart_watering/pump', 'ON');

          await prisma.pumpLog.create({
            data: {
              action: 'ON',
              mode: 'AUTO',
              deviceId: device.id,
            },
          });

          console.log('Насос включен автоматически');
        }
      } catch (error) {
        console.error('MQTT handler error:', error);
      }
    });

    // --- REST API ---
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
        console.error('/api/data error:', error);
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

        res.json(updatedDevice);
      } catch (error) {
        console.error('/api/settings POST error:', error);
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
        console.error('/api/logs error:', error);
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
        console.error('/api/pump error:', error);
        res.status(500).json({ error: 'Failed to control pump' });
      }
    });

    // --- РАЗДАЧА ФРОНТЕНДА ---
    const frontendDistPath = path.join(__dirname, '../frontend/dist');
    app.use(express.static(frontendDistPath));

    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });

    // --- ЗАПУСК HTTP СЕРВЕРА ---
    const HTTP_PORT = process.env.PORT || 4000;

    app.listen(HTTP_PORT, '0.0.0.0', () => {
      console.log(`HTTP Сервер и Интерфейс запущены на http://0.0.0.0:${HTTP_PORT}`);
    });
  } catch (error) {
    console.error('Ошибка при запуске приложения:', error);
  }
}

// Вызываем нашу функцию запуска
startServer();
