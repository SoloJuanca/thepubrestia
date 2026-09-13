-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY', 'HOURLY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE', 'EARLY_LEAVE', 'COMPLETE', 'OPEN', 'ABSENT');

-- CreateEnum
CREATE TYPE "TimeOffType" AS ENUM ('WEEKLY_OFF', 'ABSENCE', 'VACATION', 'PERMISSION', 'SICK');

-- CreateEnum
CREATE TYPE "ServiceRecurrence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "TableStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "Check" ALTER COLUMN "name" SET DEFAULT 'Cuenta de Mesa';

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "jobTitle" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "partySize" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "seatId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "leadTimeDays" INTEGER;

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSchedule" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmployeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCompensation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "CompensationType" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(12,2) NOT NULL,
    "bonuses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tipsNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAttendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTimeOff" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "TimeOffType" NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "supplierId" TEXT,
    "expectedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "recurrenceType" "ServiceRecurrence" NOT NULL DEFAULT 'MONTHLY',
    "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
    "lastServiceDate" TIMESTAMP(3),
    "nextServiceDate" TIMESTAMP(3),
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLog" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "expectedCost" DECIMAL(12,2) NOT NULL,
    "actualCost" DECIMAL(12,2) NOT NULL,
    "supplierName" TEXT,
    "expenseId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Seat_orderId_idx" ON "Seat"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSchedule_employeeId_weekday_key" ON "EmployeeSchedule"("employeeId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCompensation_employeeId_key" ON "EmployeeCompensation"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeAttendance_employeeId_checkInAt_idx" ON "EmployeeAttendance"("employeeId", "checkInAt");

-- CreateIndex
CREATE INDEX "EmployeeAttendance_locationId_checkInAt_idx" ON "EmployeeAttendance"("locationId", "checkInAt");

-- CreateIndex
CREATE INDEX "EmployeeAttendance_status_idx" ON "EmployeeAttendance"("status");

-- CreateIndex
CREATE INDEX "EmployeeTimeOff_employeeId_date_idx" ON "EmployeeTimeOff"("employeeId", "date");

-- CreateIndex
CREATE INDEX "EmployeeTimeOff_locationId_date_idx" ON "EmployeeTimeOff"("locationId", "date");

-- CreateIndex
CREATE INDEX "Service_locationId_nextServiceDate_idx" ON "Service"("locationId", "nextServiceDate");

-- CreateIndex
CREATE INDEX "Service_status_idx" ON "Service"("status");

-- CreateIndex
CREATE INDEX "ServiceLog_serviceId_performedAt_idx" ON "ServiceLog"("serviceId", "performedAt");

-- CreateIndex
CREATE INDEX "OrderItem_seatId_idx" ON "OrderItem"("seatId");

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSchedule" ADD CONSTRAINT "EmployeeSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimeOff" ADD CONSTRAINT "EmployeeTimeOff_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimeOff" ADD CONSTRAINT "EmployeeTimeOff_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLog" ADD CONSTRAINT "ServiceLog_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
