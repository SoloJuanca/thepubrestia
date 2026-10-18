/**
 * @deprecated Prefer `npm run db:seed:alena` (hoja completa Inventario_Pedidos_The_Pub_Alena_Sur.md).
 * Este script solo deja carnes/verduras Grasan sin inventar existencia.
 */
import "dotenv/config";
import { IngredientKind, PrismaClient, UnitType } from "@prisma/client";

const prisma = new PrismaClient();

const SUPPLIER_NAME = "Grasan";

type Line = {
  name: string;
  category: string;
  /** Stock / mínimo (existencia o piso de reorden) */
  minimumStock: number;
  /** Objetivo / par */
  targetStock: number;
  unit: UnitType;
  kind?: IngredientKind;
  storageNote?: string;
};

/**
 * Pedido / par de Grasan — carnes y verduras.
 * Formato fuente: NOMBRE  mínimo  objetivo  UNIDAD
 */
const LINES: Line[] = [
  // Carnes
  {
    name: "Milanesa de res",
    category: "Carnes",
    minimumStock: 1,
    targetStock: 2,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Molida de res 80/20",
    category: "Carnes",
    minimumStock: 1,
    targetStock: 6,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Milanesa de pollo",
    category: "Carnes",
    minimumStock: 1,
    targetStock: 2,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Tocino rebanado",
    category: "Carnes",
    minimumStock: 1,
    targetStock: 2,
    unit: "KG",
    kind: "RAW",
  },
  // Verduras
  {
    name: "Limón sin semilla",
    category: "Verduras",
    minimumStock: 1,
    targetStock: 10,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Cebolla blanca",
    category: "Verduras",
    minimumStock: 1,
    targetStock: 3,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Cebolla morada",
    category: "Verduras",
    minimumStock: 0.5,
    targetStock: 2,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Zanahoria",
    category: "Verduras",
    minimumStock: 1,
    targetStock: 2,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Apio",
    category: "Verduras",
    minimumStock: 1,
    targetStock: 2,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Lechuga italiana",
    category: "Verduras",
    minimumStock: 1,
    targetStock: 2,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Jitomate saladet",
    category: "Verduras",
    minimumStock: 1,
    targetStock: 3,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Jitomate bola",
    category: "Verduras",
    minimumStock: 1,
    targetStock: 2,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Chile jalapeño",
    category: "Verduras",
    minimumStock: 0.5,
    targetStock: 1,
    unit: "KG",
    kind: "RAW",
  },
  {
    name: "Perejil",
    category: "Verduras",
    minimumStock: 2,
    targetStock: 4,
    unit: "UNIT",
    kind: "RAW",
    storageNote: "Manojo",
  },
  {
    name: "Ajo",
    category: "Verduras",
    minimumStock: 0.5,
    targetStock: 1,
    unit: "KG",
    kind: "RAW",
  },
];

async function upsertGrasan(locationId: string) {
  const existing = await prisma.supplier.findFirst({
    where: {
      locationId,
      name: { contains: "Grasan", mode: "insensitive" },
    },
  });
  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: {
        name: SUPPLIER_NAME,
        notes: "Frutas, verduras y carnes — Grasan",
        active: true,
      },
    });
  }
  return prisma.supplier.create({
    data: {
      locationId,
      name: SUPPLIER_NAME,
      notes: "Frutas, verduras y carnes — Grasan",
      active: true,
    },
  });
}

async function main() {
  console.log(`Importando Grasan (${LINES.length} productos)…`);

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay sucursal activa.");

  const supplier = await upsertGrasan(location.id);

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
          category: line.category,
          kind: line.kind ?? "RAW",
          baseUnit: line.unit,
          minimumStock: line.minimumStock,
          targetStock: line.targetStock,
          preferredSupplierId: supplier.id,
          storageNote: line.storageNote ?? null,
          active: true,
        },
      });
      updated += 1;
    } else {
      ingredient = await prisma.ingredient.create({
        data: {
          locationId: location.id,
          name: line.name,
          category: line.category,
          kind: line.kind ?? "RAW",
          baseUnit: line.unit,
          currentStock: 0,
          minimumStock: line.minimumStock,
          targetStock: line.targetStock,
          averageCost: 0,
          preferredSupplierId: supplier.id,
          storageNote: line.storageNote ?? null,
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
        unit: line.unit,
        unitCost: 0,
        minOrderQty: 1,
        active: true,
      },
      update: {
        unit: line.unit,
        active: true,
      },
    });
  }

  console.log(
    `Listo · nuevos=${created} actualizados=${updated} · proveedor=${supplier.name} (existencia=0; usa db:seed:alena)`,
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
