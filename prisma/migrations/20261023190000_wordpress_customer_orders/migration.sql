-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('POS', 'WEB');

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN "wpUserId" INTEGER;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "wcProductId" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'POS',
ADD COLUMN "wcOrderId" INTEGER,
ADD COLUMN "wcSyncError" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_wpUserId_key" ON "CustomerProfile"("wpUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_wcProductId_key" ON "MenuItem"("wcProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_wcOrderId_key" ON "Order"("wcOrderId");
