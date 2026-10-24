-- CreateEnum
CREATE TYPE "DiningMode" AS ENUM ('HERE', 'TAKEOUT');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "diningMode" "DiningMode";

-- Existing named orders without a table are takeout, except staff meals.
UPDATE "Order" AS o
SET "diningMode" = 'TAKEOUT'
WHERE o."tableId" IS NULL
  AND o."guestName" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "EmployeeMealOrder" AS e WHERE e."orderId" = o.id
  );
