-- AlterEnum RoleCode
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'KITCHEN_LEAD';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'KITCHEN_COOK';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'KITCHEN_ASSISTANT';

-- Attendance QR tokens
CREATE TABLE IF NOT EXISTS "AttendanceQrToken" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceQrToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceQrToken_token_key" ON "AttendanceQrToken"("token");
CREATE INDEX IF NOT EXISTS "AttendanceQrToken_locationId_active_expiresAt_idx" ON "AttendanceQrToken"("locationId", "active", "expiresAt");

DO $$ BEGIN
  ALTER TABLE "AttendanceQrToken" ADD CONSTRAINT "AttendanceQrToken_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
