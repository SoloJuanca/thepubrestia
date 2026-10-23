-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN "stockedAt" TIMESTAMP(3),
ADD COLUMN "perishable" BOOLEAN NOT NULL DEFAULT false;

-- Verduras, frutas, carnes y proteínas parecidas. No toca preparados.
UPDATE "Ingredient"
SET "perishable" = true
WHERE kind <> 'PREP'
AND translate(lower(name || ' ' || coalesce(category, '')), 'áéíóúüñ', 'aeiouun') ~ '(verdura|vegetal|lechuga|jitomate|tomate|cebolla|cilantro|chile|pimiento|zanahoria|pepino|aguacate|apio|espinaca|brocoli|elote|ajo|limon|naranja|fruta|manzana|pina|fresa|platano|mango|melon|sandia|carne|pollo|puerco|cerdo|pescado|camaron|marisco|jamon|tocino|chorizo|arrachera|pechuga|milanesa|atun|salmon|huevo|lomo|bistec|costilla|queso|crema|leche)';

-- Fecha del lote actual: último movimiento que pasó de cero a existencia.
UPDATE "Ingredient" AS i
SET "stockedAt" = sub."createdAt"
FROM (
  SELECT DISTINCT ON (m."ingredientId")
    m."ingredientId",
    m."createdAt"
  FROM "InventoryMovement" AS m
  INNER JOIN "Ingredient" AS ing ON ing.id = m."ingredientId"
  WHERE ing."currentStock" > 0
    AND m."previousStock" <= 0
    AND m."resultingStock" > 0
  ORDER BY m."ingredientId", m."createdAt" DESC
) AS sub
WHERE i.id = sub."ingredientId";

-- Si nunca llegó a cero, usa el movimiento más antiguo.
UPDATE "Ingredient" AS i
SET "stockedAt" = sub."createdAt"
FROM (
  SELECT m."ingredientId", MIN(m."createdAt") AS "createdAt"
  FROM "InventoryMovement" AS m
  INNER JOIN "Ingredient" AS ing ON ing.id = m."ingredientId"
  WHERE ing."currentStock" > 0
    AND ing."stockedAt" IS NULL
  GROUP BY m."ingredientId"
) AS sub
WHERE i.id = sub."ingredientId";
