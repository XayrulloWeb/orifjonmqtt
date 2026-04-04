require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Подключаем модули для встроенного MQTT и путей файлов
const { Aedes } = require('aedes');
const net = require('net');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();
let aedes;

app.use(cors());
app.use(express.json());

// ==========================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ (ПОЛУЧЕНИЕ УСТРОЙСТВА)
// ==========================================
async function getDevice() {
  let device = await prisma.device.findFirst();

  if (!device) {
    device = await prisma.device.create({
      data: { deviceIdStr: 'default-device' },
    });
  }

  return device;
}

// ==========================================
// 1. НАСТРОЙКА СОБСТВЕННОГО MQTT БРОКЕРА
// ==========================================
async function setupMqttBroker() {
  aedes = await Aedes.createBroker();

  const mqttServer = net.createServer(aedes.handle);
  const MQTT_PORT = 1883;

  mqttServer.listen(MQTT_PORT, '0.0.0.0', () => {
    console.log(`MQTT Брокер успешно запущен на порту ${MQTT_PORT}`);
  });

  // Логируем подключение датчиков
  aedes.on('client', (client) => {
    console.log(`Устройство подключилось к MQTT: ${client.id}`);
  });

  // Обработка входящих сообщений (от датчиков)
  aedes.on('publish', async (packet) => {
    const topic = packet.topic;

    // Игнорируем всё, кроме нужного топика влажности
    if (topic !== 'smart_watering/moisture') {
      return;
    }

    const moisture = Number.parseInt(packet.payload.toString(), 10);
    if (Number.isNaN(moisture)) {
      return;
    }

    try {
      const device = await getDevice();

      // 1. Сохраняем показатель влажности в базу данных
      await prisma.sensorData.create({
        data: {
          moisture,
          deviceId: device.id,
        },
      });

      // 2. Логика АВТОПОЛИВА
      if (device.isAutoMode) {
        if (moisture < device.moistureThreshold) {
          // Если сухо - Включаем насос
          aedes.publish({ topic: 'smart_watering/pump', payload: 'ON' });

          await prisma.pumpLog.create({
            data: { action: 'ON', mode: 'AUTO', deviceId: device.id },
          });
          console.log('[АВТОМАТИКА] Насос ВКЛЮЧЕН');
        } else if (moisture >= device.moistureThreshold + 5) {
          // Если влажность достигла нормы (с запасом 5%) - Выключаем насос
          aedes.publish({ topic: 'smart_watering/pump', payload: 'OFF' });

          await prisma.pumpLog.create({
            data: { action: 'OFF', mode: 'AUTO', deviceId: device.id },
          });
          console.log('[АВТОМАТИКА] Насос ВЫКЛЮЧЕН');
        }
      }
    } catch (error) {
      console.error('Ошибка в MQTT обработчике:', error);
    }
  });
}


// ==========================================
// 2. REST API ДЛЯ ФРОНТЕНДА
// ==========================================

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

// Ручное управление насосом через интерфейс
app.post('/api/pump', async (req, res) => {
  try {
    if (!aedes) {
      return res.status(503).json({ error: 'MQTT broker is not ready' });
    }

    const { action } = req.body;
    const device = await getDevice();

    // Отправляем команду в наш локальный брокер Aedes
    aedes.publish({ topic: 'smart_watering/pump', payload: action });

    await prisma.pumpLog.create({
      data: {
        action,
        mode: 'MANUAL',
        deviceId: device.id,
      },
    });

    console.log(`[РУЧНОЕ УПРАВЛЕНИЕ] Насос ${action === 'ON' ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    res.json({ success: true, action });
  } catch (error) {
    res.status(500).json({ error: 'Failed to control pump' });
  }
});


// ==========================================
// 3. РАЗДАЧА ФРОНТЕНДА И ЗАПУСК СЕРВЕРА
// ==========================================

// Указываем Express папку, где лежит собранный React-проект (dist)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Для всех остальных GET маршрутов (чтобы работал роутинг React) отдаем index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Запускаем HTTP сервер на порту 4000 (разрешен в твоем AWS)
const HTTP_PORT = 4000;
async function startServer() {
  await setupMqttBroker();

  app.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP Сервер и Интерфейс запущены на http://0.0.0.0:${HTTP_PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Ошибка запуска сервера:', error);
  process.exit(1);
});
