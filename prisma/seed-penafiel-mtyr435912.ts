import "dotenv/config";
import { PrismaClient, UnitType } from "@prisma/client";
import { inventoryService } from "../src/services/inventory.service";

const prisma = new PrismaClient();

type InvoiceLine = {
  sku: string;
  barcode?: string;
  name: string;
  quantity: number;
  unit: UnitType;
  unitCost: number;
  piecesPerCase?: number;
};

/** Factura Peñafiel Bebidas MTYR435912 — PUB GAME STORE MONTERREY */
const SUPPLIER_NAME = "Peñafiel Bebidas";

const LINES: InvoiceLine[] = [
  {
    sku: "10000891",
    barcode: "7501073840331",
    name: "Peñafiel Limonada Light 0.6L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 187.93,
    piecesPerCase: 12,
  },
  {
    sku: "10000892",
    barcode: "7501073840355",
    name: "Peñafiel Naranjada Light 0.6L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 187.93,
    piecesPerCase: 12,
  },
  {
    sku: "10001141",
    barcode: "7501073841178",
    name: "Peñafiel Toronjada Light 0.6L (caja 6 pzas)",
    quantity: 2,
    unit: "BOX",
    unitCost: 93.97,
    piecesPerCase: 6,
  },
  {
    sku: "10001261",
    barcode: "7501073840843",
    name: "Peñafiel Agua Mineral 1.75L Siphon (caja 8 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 188.79,
    piecesPerCase: 8,
  },
  {
    sku: "10000552",
    barcode: "7501073839304",
    name: "Peñafiel Light Fresa 0.6L (caja 6 pzas)",
    quantity: 2,
    unit: "BOX",
    unitCost: 93.1,
    piecesPerCase: 6,
  },
  {
    sku: "10000165",
    barcode: "00076183000816",
    name: "Snapple Diet Durazno 0.473L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 194.83,
    piecesPerCase: 12,
  },
  {
    sku: "10000162",
    barcode: "00076183000915",
    name: "Snapple Diet Frambuesa 0.473L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 194.83,
    piecesPerCase: 12,
  },
  {
    sku: "10000161",
    barcode: "00076183000878",
    name: "Snapple Diet Limón 0.473L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 194.83,
    piecesPerCase: 12,
  },
  {
    sku: "10000151",
    barcode: "7501198350418",
    name: "Dr Pepper 0.6L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 194.83,
    piecesPerCase: 12,
  },
  {
    sku: "10000711",
    barcode: "7501198353877",
    name: "Dr Pepper Cherry 0.6L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 194.83,
    piecesPerCase: 12,
  },
  {
    sku: "10000204",
    barcode: "7501198352290",
    name: "Dr Pepper Diet 0.6L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 187.93,
    piecesPerCase: 12,
  },
  {
    sku: "10001830",
    barcode: "7501198355581",
    name: "Dr Pepper Cream Soda 0.6L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 194.83,
    piecesPerCase: 12,
  },
  {
    sku: "10002211",
    barcode: "7501198355840",
    name: "Dr Pepper Strawberries & Cream 0.6L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 194.83,
    piecesPerCase: 12,
  },
  {
    sku: "10001634",
    barcode: "7501198355178",
    name: "Dr Pepper Darkberry 0.6L (caja 12 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 194.83,
    piecesPerCase: 12,
  },
  {
    sku: "10001738",
    barcode: "7501073844162",
    name: "Peñafiel Agua Mineral 0.355L (caja 12 pzas)",
    quantity: 2,
    unit: "BOX",
    unitCost: 150,
    piecesPerCase: 12,
  },
  {
    sku: "10002286",
    barcode: "9002490100070",
    name: "Red Bull Energy Drink 0.250L (caja 4 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 129.31,
    piecesPerCase: 4,
  },
  {
    sku: "10002304",
    barcode: "9002490200220",
    name: "Red Bull Sugar Free 0.250L (caja 4 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 129.31,
    piecesPerCase: 4,
  },
  {
    sku: "10002283",
    barcode: "90424441",
    name: "Red Bull Tropical 0.250L (caja 4 pzas)",
    quantity: 1,
    unit: "BOX",
    unitCost: 129.31,
    piecesPerCase: 4,
  },
];

async function upsertSupplier(locationId: string, name: string) {
  const existing = await prisma.supplier.findFirst({
    where: { locationId, name },
  });
  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: {
        active: true,
        notes: "Factura MTYR435912 · Peñafiel / Keurig Dr Pepper",
      },
    });
  }
  return prisma.supplier.create({
    data: {
      locationId,
      name,
      contact: "Peñafiel Bebidas SA de CV",
      notes: "RFC PBE900712TV4 · Factura MTYR435912",
      active: true,
    },
  });
}

async function main() {
  console.log(`Importando factura Peñafiel MTYR435912 (${LINES.length} líneas)…`);

  const location =
    (await prisma.location.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.location.create({
      data: {
        id: "seed-location-main",
        name: "The Pub GameStore",
        timezone: "America/Mexico_City",
        active: true,
      },
    }));

  const admin = await prisma.user.findFirst({
    where: { email: { in: ["admin@thepub.local", "superadmin@thepub.local"] } },
    orderBy: { createdAt: "asc" },
  });

  const supplier = await upsertSupplier(location.id, SUPPLIER_NAME);

  let created = 0;
  let updated = 0;

  for (const line of LINES) {
    let ingredient = await prisma.ingredient.findFirst({
      where: { locationId: location.id, name: line.name },
    });

    if (ingredient) {
      ingredient = await prisma.ingredient.update({
        where: { id: ingredient.id },
        data: {
          category: "Bebidas",
          baseUnit: line.unit,
          averageCost: line.unitCost,
          preferredSupplierId: supplier.id,
          active: true,
          targetStock:
            ingredient.targetStock ?? Math.max(line.quantity * 2, 2),
        },
      });
      updated += 1;
    } else {
      ingredient = await prisma.ingredient.create({
        data: {
          locationId: location.id,
          name: line.name,
          category: "Bebidas",
          baseUnit: line.unit,
          currentStock: 0,
          minimumStock: 1,
          targetStock: Math.max(line.quantity * 2, 2),
          averageCost: line.unitCost,
          preferredSupplierId: supplier.id,
          active: true,
        },
      });
      created += 1;
    }

    await prisma.supplierProduct.upsert({
      where: {
        supplierId_ingredientId: {
          supplierId: supplier.id,
          ingredientId: ingredient.id,
        },
      },
      create: {
        supplierId: supplier.id,
        ingredientId: ingredient.id,
        supplierSku: line.sku,
        unit: line.unit,
        unitCost: line.unitCost,
        minOrderQty: 1,
        active: true,
      },
      update: {
        supplierSku: line.sku,
        unit: line.unit,
        unitCost: line.unitCost,
        active: true,
      },
    });

    await inventoryService.applyStockChange({
      ingredientId: ingredient.id,
      quantityDelta: line.quantity,
      movementType: "PURCHASE",
      referenceType: "MANUAL",
      unitCost: line.unitCost,
      notes: `Factura Peñafiel MTYR435912 · SKU ${line.sku}${
        line.barcode ? ` · EAN ${line.barcode}` : ""
      }${line.piecesPerCase ? ` · ${line.piecesPerCase} pzas/caja` : ""}`,
      employeeId: admin?.id ?? null,
    });
  }

  const totalBoxes = LINES.reduce((s, l) => s + l.quantity, 0);
  const subtotal = LINES.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  console.log(
    `Listo · proveedor=${SUPPLIER_NAME} nuevos=${created} actualizados=${updated} cajas=${totalBoxes} subtotal≈$${subtotal.toFixed(2)}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
