-- AlterTable
ALTER TABLE "EmployeeAttendance" ADD COLUMN IF NOT EXISTS "openShiftKey" TEXT;

-- Backfill open shifts (one open per employee)
UPDATE "EmployeeAttendance" AS ea
SET "openShiftKey" = "employeeId"
WHERE "status" = 'OPEN'
  AND "openShiftKey" IS NULL
  AND "id" = (
    SELECT e2."id"
    FROM "EmployeeAttendance" e2
    WHERE e2."employeeId" = ea."employeeId"
      AND e2."status" = 'OPEN'
    ORDER BY e2."checkInAt" DESC
    LIMIT 1
  );

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeAttendance_openShiftKey_key" ON "EmployeeAttendance"("openShiftKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceLog_expenseId_key" ON "ServiceLog"("expenseId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceLog_expenseId_fkey'
  ) THEN
    ALTER TABLE "ServiceLog"
      ADD CONSTRAINT "ServiceLog_expenseId_fkey"
      FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
