-- CreateTable
CREATE TABLE "EmployeeMeal" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMealOrder" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeMealOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMeal_locationId_serviceDate_key" ON "EmployeeMeal"("locationId", "serviceDate");

-- CreateIndex
CREATE INDEX "EmployeeMeal_locationId_serviceDate_idx" ON "EmployeeMeal"("locationId", "serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMealOrder_orderId_key" ON "EmployeeMealOrder"("orderId");

-- CreateIndex
CREATE INDEX "EmployeeMealOrder_userId_idx" ON "EmployeeMealOrder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMealOrder_mealId_userId_key" ON "EmployeeMealOrder"("mealId", "userId");

-- AddForeignKey
ALTER TABLE "EmployeeMeal" ADD CONSTRAINT "EmployeeMeal_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMeal" ADD CONSTRAINT "EmployeeMeal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMealOrder" ADD CONSTRAINT "EmployeeMealOrder_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "EmployeeMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMealOrder" ADD CONSTRAINT "EmployeeMealOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMealOrder" ADD CONSTRAINT "EmployeeMealOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
