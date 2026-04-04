-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "deviceIdStr" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Новое устройство',
    "moistureThreshold" INTEGER NOT NULL DEFAULT 40,
    "isAutoMode" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" TIMESTAMP(3),
    "lastMoisture" INTEGER,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorData" (
    "id" SERIAL NOT NULL,
    "moisture" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" INTEGER NOT NULL,

    CONSTRAINT "SensorData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PumpLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" INTEGER NOT NULL,

    CONSTRAINT "PumpLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceIdStr_key" ON "Device"("deviceIdStr");

-- AddForeignKey
ALTER TABLE "SensorData" ADD CONSTRAINT "SensorData_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PumpLog" ADD CONSTRAINT "PumpLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
