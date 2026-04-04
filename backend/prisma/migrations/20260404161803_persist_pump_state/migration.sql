-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "lastCommandReason" TEXT,
ADD COLUMN     "pumpState" TEXT NOT NULL DEFAULT 'OFF',
ADD COLUMN     "pumpUpdatedAt" TIMESTAMP(3),
ALTER COLUMN "name" SET DEFAULT 'New device';
