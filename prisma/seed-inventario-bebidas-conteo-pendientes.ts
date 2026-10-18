import "dotenv/config";
import { IngredientKind, PrismaClient, UnitType } from "@prisma/client";
import { inventoryService } from "../src/services/inventory.service";

/**
 * Pendientes del conteo 18-oct confirmados por el usuario:
 * - Joya Durazno / Joya Manzana (2 SKUs)
 * - Monster Lo-Carb (nuevo)
 * - Dr Pepper Dark Cream → Dark Cherry
 * - Peñafiel lata agua mineral 355 ml
 * - Monster Energy → Negro, Zero Sugar verde → Tapa Verde
 */

const prisma = new PrismaClient();

async function ensureSupplier(locationId: string, nameContains: string) {
  const s = await prisma.supplier.findFirst({
    where: {
      locationId,
      name: { contains: nameContains, mode: "insensitive" },
    },
  });
  return s?.id ?? null;
}

async function ensureDrinkSku(params: {
  locationId: string;
  categoryId: string;
  ingredientName: string;
  menuName: string;
  sku: string;
  price: number;
  supplierId: string | null;
  packSize?: number;
  tag: string;
}) {
  let ingredient = await prisma.ingredient.findFirst({
    where: {
      locationId: params.locationId,
      name: { equals: params.ingredientName, mode: "insensitive" },
    },
  });

  if (!ingredient) {
    ingredient = await prisma.ingredient.create({
      data: {
        locationId: params.locationId,
        name: params.ingredientName,
        category: "Bebidas",
        kind: IngredientKind.PACKAGED,
        baseUnit: UnitType.UNIT,
        packSize: params.packSize ?? 12,
        currentStock: 0,
        minimumStock: 6,
        averageCost: 0,
        preferredSupplierId: params.supplierId,
        active: true,
      },
    });
  } else {
    ingredient = await prisma.ingredient.update({
      where: { id: ingredient.id },
      data: {
        kind: IngredientKind.PACKAGED,
        baseUnit: UnitType.UNIT,
        preferredSupplierId: params.supplierId ?? ingredient.preferredSupplierId,
        category: "Bebidas",
        active: true,
      },
    });
  }

  if (params.supplierId) {
    await prisma.supplierProduct.upsert({
      where: {
        supplierId_ingredientId: {
          supplierId: params.supplierId,
          ingredientId: ingredient.id,
        },
      },
      create: {
        supplierId: params.supplierId,
        ingredientId: ingredient.id,
        unit: UnitType.UNIT,
        unitCost: 0,
        minOrderQty: 1,
        active: true,
      },
      update: { active: true, unit: UnitType.UNIT },
    });
  }

  const existingItem = await prisma.menuItem.findFirst({
    where: { locationId: params.locationId, sku: params.sku },
  });

  const menuItem = existingItem
    ? await prisma.menuItem.update({
        where: { id: existingItem.id },
        data: {
          name: params.menuName,
          price: params.price,
          categoryId: params.categoryId,
          available: true,
          active: true,
          requiresPrep: false,
        },
      })
    : await prisma.menuItem.create({
        data: {
          locationId: params.locationId,
          categoryId: params.categoryId,
          name: params.menuName,
          sku: params.sku,
          price: params.price,
          taxRate: 0.16,
          available: true,
          active: true,
          requiresPrep: false,
          tags: [params.tag, "bebida"],
        },
      });

  await prisma.recipeItem.upsert({
    where: {
      menuItemId_ingredientId: {
        menuItemId: menuItem.id,
        ingredientId: ingredient.id,
      },
    },
    create: {
      menuItemId: menuItem.id,
      ingredientId: ingredient.id,
      quantity: 1,
      unit: UnitType.UNIT,
    },
    update: { quantity: 1, unit: UnitType.UNIT },
  });

  return ingredient;
}

async function setStock(
  locationId: string,
  ingredientName: string,
  quantity: number,
  employeeId: string | null,
  note: string,
) {
  const ingredient = await prisma.ingredient.findFirst({
    where: {
      locationId,
      name: { equals: ingredientName, mode: "insensitive" },
      active: true,
    },
  });
  if (!ingredient) {
    console.error(`✗ No encontrado: ${ingredientName}`);
    return;
  }
  const current = Number(ingredient.currentStock);
  if (current === quantity) {
    console.log(`= ${ingredientName} ya en ${quantity}`);
    return;
  }
  try {
    await inventoryService.setStockAbsolute({
      ingredientId: ingredient.id,
      newStock: quantity,
      employeeId,
      notes: note,
    });
    console.log(`✓ ${ingredientName}: ${current} → ${quantity}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ya tiene ese valor")) {
      console.log(`= ${ingredientName} ya en ${quantity}`);
      return;
    }
    throw e;
  }
}

async function main() {
  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay sucursal activa.");

  const admin = await prisma.user.findFirst({
    where: {
      email: { in: ["admin@thepub.local", "superadmin@thepub.local"] },
    },
  });

  const category =
    (await prisma.menuCategory.findFirst({
      where: { locationId: location.id, name: "Bebidas" },
    })) ??
    (await prisma.menuCategory.create({
      data: {
        locationId: location.id,
        name: "Bebidas",
        sortOrder: 10,
        active: true,
      },
    }));

  const cocaId = await ensureSupplier(location.id, "Coca");
  const penafielId = await ensureSupplier(location.id, "Peñafiel");

  // Joya — 2 SKUs
  await ensureDrinkSku({
    locationId: location.id,
    categoryId: category.id,
    ingredientName: "Joya Durazno (pza)",
    menuName: "Joya Durazno",
    sku: "BEV-JOYA-DUR",
    price: 30,
    supplierId: cocaId,
    tag: "Refrescos",
  });
  await ensureDrinkSku({
    locationId: location.id,
    categoryId: category.id,
    ingredientName: "Joya Manzana (pza)",
    menuName: "Joya Manzana",
    sku: "BEV-JOYA-MAN",
    price: 30,
    supplierId: cocaId,
    tag: "Refrescos",
  });

  // Desactivar Joya genérica en menú (sigue el insumo por si hay historial)
  await prisma.menuItem.updateMany({
    where: { locationId: location.id, sku: "BEV-JOYA" },
    data: { active: false, available: false },
  });

  // Monster Lo-Carb
  await ensureDrinkSku({
    locationId: location.id,
    categoryId: category.id,
    ingredientName: "Monster Lo-Carb (pza)",
    menuName: "Monster Lo-Carb",
    sku: "BEV-MON-LOCARB",
    price: 30,
    supplierId: cocaId,
    tag: "Energizantes",
  });

  // Peñafiel agua mineral 355 ml (pieza / lata)
  await ensureDrinkSku({
    locationId: location.id,
    categoryId: category.id,
    ingredientName: "Peñafiel Agua Mineral 355 ml (pza)",
    menuName: "Peñafiel Agua Mineral",
    sku: "BEV-PEN-AGUA-355",
    price: 25,
    supplierId: penafielId,
    packSize: 12,
    tag: "Agua / otros",
  });

  const note = "Conteo físico bebidas 18-oct-2026 (pendientes)";

  await setStock(location.id, "Joya Durazno (pza)", 4, admin?.id ?? null, note);
  await setStock(location.id, "Joya Manzana (pza)", 3, admin?.id ?? null, note);
  await setStock(
    location.id,
    "Monster Lo-Carb (pza)",
    8,
    admin?.id ?? null,
    note,
  );
  await setStock(
    location.id,
    "Monster Negro (pza)",
    5,
    admin?.id ?? null,
    `${note} · Monster Energy`,
  );
  await setStock(
    location.id,
    "Monster Tapa Verde (pza)",
    6,
    admin?.id ?? null,
    `${note} · Monster Zero Sugar verde`,
  );
  await setStock(
    location.id,
    "Dr Pepper Dark Cherry (pza)",
    14,
    admin?.id ?? null,
    `${note} · Dr Pepper Dark Cream`,
  );
  await setStock(
    location.id,
    "Peñafiel Agua Mineral 355 ml (pza)",
    5,
    admin?.id ?? null,
    `${note} · Peñafiel lata 355 ml`,
  );

  console.log("Pendientes aplicados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
