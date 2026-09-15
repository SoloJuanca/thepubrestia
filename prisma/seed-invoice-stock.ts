import "dotenv/config";
import { PrismaClient, UnitType } from "@prisma/client";
import { inventoryService } from "../src/services/inventory.service";

const prisma = new PrismaClient();

type InvoiceLine = {
  sku: string | null;
  name: string;
  category: string;
  quantity: number;
  unit: UnitType;
  unitCost: number;
  supplierName: string;
};

/**
 * Factura / pedido recibido — The Pub GameStore
 * Cantidades y costos unitarios del documento del usuario.
 */
const LINES: InvoiceLine[] = [
  {
    sku: "DMCF03785",
    name: "McCain Papa Flavorlast 3/8 sin cáscara cobertura XL",
    category: "Papas / Congelados",
    quantity: 5,
    unit: "BOX",
    unitCost: 754,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "H-PS71616",
    name: "Boneless naturales Pilgrim's (caja 6x2 kg)",
    category: "Proteínas",
    quantity: 2,
    unit: "BOX",
    unitCost: 2328,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "DMCF03731",
    name: "McCain Papa Camote (caja 6x2.5 lb)",
    category: "Papas / Congelados",
    quantity: 1,
    unit: "BOX",
    unitCost: 616,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "JH10121",
    name: "Ketchup sobre Mex Heinz (caja 1000 x 9 g)",
    category: "Salsas / Condimentos",
    quantity: 1,
    unit: "BOX",
    unitCost: 564,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "G50006",
    name: "Queso Pepper Jack barra 5 lb",
    category: "Lácteos / Quesos",
    quantity: 2,
    unit: "UNIT",
    unitCost: 371,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "JH10477",
    name: "Salsa inglesa Worcestershire LP (caja 12 x 148 ml)",
    category: "Salsas / Condimentos",
    quantity: 1,
    unit: "BOX",
    unitCost: 724,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "G02434",
    name: "Queso Provolone natural rebanado 1.5 lb",
    category: "Lácteos / Quesos",
    quantity: 2,
    unit: "UNIT",
    unitCost: 143,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "G50071",
    name: "Queso Mild Cheddar rebanado 1.5 lb",
    category: "Lácteos / Quesos",
    quantity: 2,
    unit: "UNIT",
    unitCost: 134,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "G50033",
    name: "Queso Parmesano rallado fino bolsa 5 lb",
    category: "Lácteos / Quesos",
    quantity: 2,
    unit: "UNIT",
    unitCost: 552,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: "FP-CF0021",
    name: "Bollo brioche (caja 30 x 78 g)",
    category: "Panadería",
    quantity: 4,
    unit: "BOX",
    unitCost: 245,
    supplierName: "Distribuidor Sysco/Foodservice",
  },
  {
    sku: null,
    name: "Italian Topping 2.27 kg Hormel",
    category: "Embutidos / Toppings",
    quantity: 5,
    unit: "UNIT",
    unitCost: 159.03,
    supplierName: "Proveedor embutidos / secos",
  },
  {
    sku: null,
    name: "Salami Tangamanga",
    category: "Embutidos / Toppings",
    quantity: 5,
    unit: "UNIT",
    unitCost: 51.6,
    supplierName: "Proveedor embutidos / secos",
  },
  {
    sku: null,
    name: "Pepperoni madurado 2.27 kg Azerta",
    category: "Embutidos / Toppings",
    quantity: 2,
    unit: "UNIT",
    unitCost: 499.4,
    supplierName: "Proveedor embutidos / secos",
  },
  {
    sku: null,
    name: "Mantequilla 1 kg NocheBuena",
    category: "Lácteos / Quesos",
    quantity: 1,
    unit: "KG",
    unitCost: 200,
    supplierName: "Proveedor embutidos / secos",
  },
  {
    sku: null,
    name: "Queso crema barra 180 g Philadelphia",
    category: "Lácteos / Quesos",
    quantity: 1,
    unit: "UNIT",
    unitCost: 39.24,
    supplierName: "Proveedor embutidos / secos",
  },
  {
    sku: null,
    name: "Crema de avellana 950 g Nutella",
    category: "Postres / Dulces",
    quantity: 1,
    unit: "UNIT",
    unitCost: 180.5,
    supplierName: "Proveedor embutidos / secos",
  },
  {
    sku: null,
    name: "Salchicha hot dog 3 kg Fud",
    category: "Embutidos / Toppings",
    quantity: 1,
    unit: "UNIT",
    unitCost: 232.5,
    supplierName: "Proveedor embutidos / secos",
  },
];

async function upsertSupplier(locationId: string, name: string) {
  const existing = await prisma.supplier.findFirst({
    where: { locationId, name },
  });
  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: { active: true },
    });
  }
  return prisma.supplier.create({
    data: {
      locationId,
      name,
      notes: "Creado desde carga de factura / pedido",
      active: true,
    },
  });
}

async function main() {
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

  let created = 0;
  let updated = 0;
  let stockApplied = 0;

  for (const line of LINES) {
    const supplier = await upsertSupplier(location.id, line.supplierName);

    let ingredient = await prisma.ingredient.findFirst({
      where: { locationId: location.id, name: line.name },
    });

    if (ingredient) {
      ingredient = await prisma.ingredient.update({
        where: { id: ingredient.id },
        data: {
          category: line.category,
          baseUnit: line.unit,
          averageCost: line.unitCost,
          preferredSupplierId: supplier.id,
          active: true,
          minimumStock: ingredient.minimumStock,
          targetStock:
            ingredient.targetStock ??
            Math.max(line.quantity * 2, Number(ingredient.minimumStock) || 0),
        },
      });
      updated += 1;
    } else {
      ingredient = await prisma.ingredient.create({
        data: {
          locationId: location.id,
          name: line.name,
          category: line.category,
          baseUnit: line.unit,
          currentStock: 0,
          minimumStock: Math.max(1, Math.ceil(line.quantity * 0.5)),
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

    if (line.quantity > 0) {
      await inventoryService.applyStockChange({
        ingredientId: ingredient.id,
        quantityDelta: line.quantity,
        movementType: "PURCHASE",
        referenceType: "MANUAL",
        unitCost: line.unitCost,
        notes: `Carga factura${line.sku ? ` · SKU ${line.sku}` : ""} · ${line.name}`,
        employeeId: admin?.id ?? null,
      });
      stockApplied += 1;
    }
  }

  console.log(
    `Listo · ingredientes nuevos=${created} actualizados=${updated} entradas stock=${stockApplied}`,
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
