-- AlterEnum MovementType
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'PRODUCTION_IN';
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'PRODUCTION_OUT';

-- AlterEnum ReferenceType
ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'PRODUCTION';

-- CreateEnum IngredientKind
DO $$ BEGIN
  CREATE TYPE "IngredientKind" AS ENUM ('RAW', 'PREP', 'FROZEN', 'PACKAGED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Ingredient
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "kind" "IngredientKind" NOT NULL DEFAULT 'RAW';
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "packSize" INTEGER;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "storageNote" TEXT;

CREATE INDEX IF NOT EXISTS "Ingredient_locationId_kind_idx" ON "Ingredient"("locationId", "kind");

-- CreateTable PrepRecipe
CREATE TABLE IF NOT EXISTS "PrepRecipe" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "outputIngredientId" TEXT NOT NULL,
    "outputQuantity" DECIMAL(14,4) NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepRecipe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PrepRecipe_outputIngredientId_key" ON "PrepRecipe"("outputIngredientId");
CREATE INDEX IF NOT EXISTS "PrepRecipe_locationId_active_idx" ON "PrepRecipe"("locationId", "active");

-- CreateTable PrepRecipeItem
CREATE TABLE IF NOT EXISTS "PrepRecipeItem" (
    "id" TEXT NOT NULL,
    "prepRecipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" "UnitType" NOT NULL,

    CONSTRAINT "PrepRecipeItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PrepRecipeItem_prepRecipeId_ingredientId_key" ON "PrepRecipeItem"("prepRecipeId", "ingredientId");
CREATE INDEX IF NOT EXISTS "PrepRecipeItem_ingredientId_idx" ON "PrepRecipeItem"("ingredientId");

-- CreateTable ProductionBatch
CREATE TABLE IF NOT EXISTS "ProductionBatch" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "outputIngredientId" TEXT NOT NULL,
    "quantityTheoretical" DECIMAL(14,4) NOT NULL,
    "quantityProduced" DECIMAL(14,4) NOT NULL,
    "yieldPercent" DECIMAL(8,2) NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductionBatch_locationId_producedAt_idx" ON "ProductionBatch"("locationId", "producedAt");
CREATE INDEX IF NOT EXISTS "ProductionBatch_outputIngredientId_producedAt_idx" ON "ProductionBatch"("outputIngredientId", "producedAt");

-- CreateTable ProductionBatchInput
CREATE TABLE IF NOT EXISTS "ProductionBatchInput" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" "UnitType" NOT NULL,

    CONSTRAINT "ProductionBatchInput_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductionBatchInput_batchId_idx" ON "ProductionBatchInput"("batchId");
CREATE INDEX IF NOT EXISTS "ProductionBatchInput_ingredientId_idx" ON "ProductionBatchInput"("ingredientId");

-- FKs (ignore if already exist)
DO $$ BEGIN
  ALTER TABLE "PrepRecipe" ADD CONSTRAINT "PrepRecipe_outputIngredientId_fkey"
    FOREIGN KEY ("outputIngredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PrepRecipeItem" ADD CONSTRAINT "PrepRecipeItem_prepRecipeId_fkey"
    FOREIGN KEY ("prepRecipeId") REFERENCES "PrepRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PrepRecipeItem" ADD CONSTRAINT "PrepRecipeItem_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_outputIngredientId_fkey"
    FOREIGN KEY ("outputIngredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionBatchInput" ADD CONSTRAINT "ProductionBatchInput_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionBatchInput" ADD CONSTRAINT "ProductionBatchInput_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
