import "dotenv/config";
import { PrismaClient, UnitType } from "@prisma/client";
import { inventoryService } from "../src/services/inventory.service";

const prisma = new PrismaClient();

const SUPPLIER_NAME = "Boing / Jugos";

type Line = {
  name: string;
  sku: string;
  quantity: number;
  unit: UnitType;
  unitCost: number;
  piecesPerCase: number;
  /** Solo catálogo (sin entrada de stock) */
  catalogOnly?: boolean;
};

/**
 * Boing — pedido actual + catálogo futuro
 * Vidrio 354 ml: 2 cajas x24 mango, 1 caja x24 uva
 * Triangulito 200 ml: 2 cajas x18 de cada sabor (uva, mango, guayaba, fresa, manzana)
 * Limonada y naranjada: disponibles en catálogo (stock 0 hasta próximo pedido)
 */
const LINES: Line[] = [
  // Pedido vidrio 354 ml
  {
    name: "Boing Mango vidrio 354 ml (caja 24 pzas)",
    sku: "BOING-MANGO-354-24",
    quantity: 2,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 24,
  },
  {
    name: "Boing Uva vidrio 354 ml (caja 24 pzas)",
    sku: "BOING-UVA-354-24",
    quantity: 1,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 24,
  },
  // Catálogo futuro vidrio 354 ml
  {
    name: "Boing Limonada vidrio 354 ml (caja 24 pzas)",
    sku: "BOING-LIMONADA-354-24",
    quantity: 0,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 24,
    catalogOnly: true,
  },
  {
    name: "Boing Naranjada vidrio 354 ml (caja 24 pzas)",
    sku: "BOING-NARANJADA-354-24",
    quantity: 0,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 24,
    catalogOnly: true,
  },
  // Pedido triangulito 200 ml — 2 cajas de 18 por sabor
  {
    name: "Boing Uva triangulito 200 ml (caja 18 pzas)",
    sku: "BOING-UVA-200-18",
    quantity: 2,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 18,
  },
  {
    name: "Boing Mango triangulito 200 ml (caja 18 pzas)",
    sku: "BOING-MANGO-200-18",
    quantity: 2,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 18,
  },
  {
    name: "Boing Guayaba triangulito 200 ml (caja 18 pzas)",
    sku: "BOING-GUAYABA-200-18",
    quantity: 2,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 18,
  },
  {
    name: "Boing Fresa triangulito 200 ml (caja 18 pzas)",
    sku: "BOING-FRESA-200-18",
    quantity: 2,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 18,
  },
  {
    name: "Boing Manzana triangulito 200 ml (caja 18 pzas)",
    sku: "BOING-MANZANA-200-18",
    quantity: 2,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 18,
  },
  // Catálogo futuro triangulito
  {
    name: "Boing Limonada triangulito 200 ml (caja 18 pzas)",
    sku: "BOING-LIMONADA-200-18",
    quantity: 0,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 18,
    catalogOnly: true,
  },
  {
    name: "Boing Naranjada triangulito 200 ml (caja 18 pzas)",
    sku: "BOING-NARANJADA-200-18",
    quantity: 0,
    unit: "BOX",
    unitCost: 0,
    piecesPerCase: 18,
    catalogOnly: true,
  },
];

async function upsertSupplier(locationId: string, name: string) {
  const existing = await prisma.supplier.findFirst({
    where: { locationId, name },
  });
  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: { active: true, notes: "Jugos Boing — vidrio y triangulito" },
    });
  }
  return prisma.supplier.create({
    data: {
      locationId,
      name,
      notes: "Jugos Boing — vidrio 354 ml y triangulito 200 ml",
      active: true,
    },
  });
}

async function main() {
  console.log(`Importando Boing (${LINES.length} productos)…`);

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay sucursal activa.");

  const admin = await prisma.user.findFirst({
    where: { email: { in: ["admin@thepub.local", "superadmin@thepub.local"] } },
  });

  const supplier = await upsertSupplier(location.id, SUPPLIER_NAME);

  let created = 0;
  let updated = 0;
  let stocked = 0;

  for (const line of LINES) {
    let ingredient = await prisma.ingredient.findFirst({
      where: { locationId: location.id, name: line.name },
    });

    if (ingredient) {
      ingredient = await prisma.ingredient.update({
        where: { id: ingredient.id },
        data: {
          category: "Bebidas · Boing",
          baseUnit: line.unit,
          preferredSupplierId: supplier.id,
          active: true,
          targetStock: Math.max(line.piecesPerCase > 18 ? 4 : 4, 2),
        },
      });
      updated += 1;
    } else {
      ingredient = await prisma.ingredient.create({
        data: {
          locationId: location.id,
          name: line.name,
          category: "Bebidas · Boing",
          baseUnit: line.unit,
          currentStock: 0,
          minimumStock: 1,
          targetStock: 4,
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

    if (!line.catalogOnly && line.quantity > 0) {
      await inventoryService.applyStockChange({
        ingredientId: ingredient.id,
        quantityDelta: line.quantity,
        movementType: "PURCHASE",
        referenceType: "MANUAL",
        unitCost: line.unitCost || null,
        notes: `Pedido Boing · ${line.piecesPerCase} pzas/caja · SKU ${line.sku}`,
        employeeId: admin?.id ?? null,
      });
      stocked += 1;
    }
  }

  const boxesIn = LINES.filter((l) => !l.catalogOnly).reduce(
    (s, l) => s + l.quantity,
    0,
  );
  console.log(
    `Listo · proveedor=${SUPPLIER_NAME} nuevos=${created} actualizados=${updated} con stock=${stocked} cajas recibidas=${boxesIn}`,
  );
  console.log(
    "Nota: costos en $0 — actualízalos cuando tengas precio de factura.",
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
