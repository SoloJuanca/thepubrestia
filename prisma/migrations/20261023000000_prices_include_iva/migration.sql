-- Menu prices already include IVA. Stop storing an extra tax rate
-- and reprice open checks so the charged total matches the listed price.

UPDATE "MenuItem" SET "taxRate" = 0;

UPDATE "OrderItem" AS oi
SET
  "taxAmount" = 0,
  "lineTotal" = ROUND(
    (("unitPrice" + "modifiersTotal") * "quantity" - "discountAmount")::numeric,
    2
  )
FROM "Check" AS c
WHERE oi."checkId" = c.id
  AND c.status = 'OPEN'
  AND oi.status <> 'CANCELLED';

UPDATE "Check" AS c
SET
  "taxTotal" = 0,
  "subtotal" = COALESCE(sub.subtotal, 0),
  "discountTotal" = COALESCE(sub.discount, 0),
  "total" = COALESCE(sub.total, 0)
FROM (
  SELECT
    "checkId",
    ROUND(SUM((("unitPrice" + "modifiersTotal") * "quantity" - "discountAmount"))::numeric, 2) AS subtotal,
    ROUND(SUM("discountAmount")::numeric, 2) AS discount,
    ROUND(SUM("lineTotal")::numeric, 2) AS total
  FROM "OrderItem"
  WHERE status <> 'CANCELLED'
  GROUP BY "checkId"
) AS sub
WHERE c.id = sub."checkId"
  AND c.status = 'OPEN';
