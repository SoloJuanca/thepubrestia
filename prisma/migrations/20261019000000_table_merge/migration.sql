-- AlterTable
ALTER TABLE "RestaurantTable" ADD COLUMN "joinedToId" TEXT;

-- CreateIndex
CREATE INDEX "RestaurantTable_joinedToId_idx" ON "RestaurantTable"("joinedToId");

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_joinedToId_fkey" FOREIGN KEY ("joinedToId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
