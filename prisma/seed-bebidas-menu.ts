import "dotenv/config";
import {
  IngredientKind,
  PrismaClient,
  UnitType,
} from "@prisma/client";

const prisma = new PrismaClient();

type DrinkDef = {
  menuName: string;
  sku: string;
  price: number;
  requiresPrep: boolean;
  /** Substring to match existing boxed ingredient name */
  match?: string;
  /** Create this sell-unit ingredient if no match */
  ingredientName: string;
  packSize?: number;
  category: string;
};

const DRINKS: DrinkDef[] = [
  // Dr Pepper $30
  { menuName: "Dr Pepper Regular", sku: "BEV-DP-REG", price: 30, requiresPrep: false, match: "Dr Pepper 0.6L", ingredientName: "Dr Pepper Regular (pza)", packSize: 12, category: "Dr Pepper" },
  { menuName: "Dr Pepper Light", sku: "BEV-DP-LIGHT", price: 30, requiresPrep: false, match: "Dr Pepper Diet", ingredientName: "Dr Pepper Light (pza)", packSize: 12, category: "Dr Pepper" },
  { menuName: "Dr Pepper Cherry", sku: "BEV-DP-CHERRY", price: 30, requiresPrep: false, match: "Dr Pepper Cherry", ingredientName: "Dr Pepper Cherry (pza)", packSize: 12, category: "Dr Pepper" },
  { menuName: "Dr Pepper Cream", sku: "BEV-DP-CREAM", price: 30, requiresPrep: false, match: "Dr Pepper Cream", ingredientName: "Dr Pepper Cream (pza)", packSize: 12, category: "Dr Pepper" },
  { menuName: "Dr Pepper Dark Cherry", sku: "BEV-DP-DARK", price: 30, requiresPrep: false, match: "Dr Pepper Darkberry", ingredientName: "Dr Pepper Dark Cherry (pza)", packSize: 12, category: "Dr Pepper" },
  // Boing $30 — prefer triangulito / vidrio mango-uva
  { menuName: "Boing Mango", sku: "BEV-BOING-MANGO", price: 30, requiresPrep: false, match: "Boing Mango", ingredientName: "Boing Mango (pza)", packSize: 24, category: "Boing" },
  { menuName: "Boing Uva", sku: "BEV-BOING-UVA", price: 30, requiresPrep: false, match: "Boing Uva", ingredientName: "Boing Uva (pza)", packSize: 24, category: "Boing" },
  { menuName: "Boing Guayaba", sku: "BEV-BOING-GUAYABA", price: 30, requiresPrep: false, match: "Boing Guayaba", ingredientName: "Boing Guayaba (pza)", packSize: 18, category: "Boing" },
  { menuName: "Boing Fresa", sku: "BEV-BOING-FRESA", price: 30, requiresPrep: false, match: "Boing Fresa", ingredientName: "Boing Fresa (pza)", packSize: 18, category: "Boing" },
  // Peñafielada $35
  { menuName: "Peñafielada Limón", sku: "BEV-PEN-LIMON", price: 35, requiresPrep: false, match: "Peñafiel Limonada", ingredientName: "Peñafielada Limón (pza)", packSize: 12, category: "Peñafielada" },
  { menuName: "Peñafielada Naranjada", sku: "BEV-PEN-NARANJA", price: 35, requiresPrep: false, match: "Peñafiel Naranjada", ingredientName: "Peñafielada Naranjada (pza)", packSize: 12, category: "Peñafielada" },
  { menuName: "Peñafielada Toronja", sku: "BEV-PEN-TORONJA", price: 35, requiresPrep: false, match: "Peñafiel Toronjada", ingredientName: "Peñafielada Toronja (pza)", packSize: 6, category: "Peñafielada" },
  { menuName: "Peñafielada Fresa", sku: "BEV-PEN-FRESA", price: 35, requiresPrep: false, match: "Peñafiel Light Fresa", ingredientName: "Peñafielada Fresa (pza)", packSize: 6, category: "Peñafielada" },
  // Coca / sabores $30
  { menuName: "Coca-Cola Regular", sku: "BEV-COCA-REG", price: 30, requiresPrep: false, ingredientName: "Coca-Cola Regular (pza)", packSize: 12, category: "Refrescos" },
  { menuName: "Coca-Cola Light", sku: "BEV-COCA-LIGHT", price: 30, requiresPrep: false, ingredientName: "Coca-Cola Light (pza)", packSize: 12, category: "Refrescos" },
  { menuName: "Coca-Cola Zero", sku: "BEV-COCA-ZERO", price: 30, requiresPrep: false, ingredientName: "Coca-Cola Zero (pza)", packSize: 12, category: "Refrescos" },
  { menuName: "Fanta", sku: "BEV-FANTA", price: 30, requiresPrep: false, ingredientName: "Fanta (pza)", packSize: 12, category: "Refrescos" },
  { menuName: "Fresca", sku: "BEV-FRESCA", price: 30, requiresPrep: false, ingredientName: "Fresca (pza)", packSize: 12, category: "Refrescos" },
  { menuName: "Joya", sku: "BEV-JOYA", price: 30, requiresPrep: false, ingredientName: "Joya (pza)", packSize: 12, category: "Refrescos" },
  // Monster $30
  { menuName: "Monster Blanco", sku: "BEV-MON-WHITE", price: 30, requiresPrep: false, ingredientName: "Monster Blanco (pza)", packSize: 12, category: "Energizantes" },
  { menuName: "Monster Negro", sku: "BEV-MON-BLACK", price: 30, requiresPrep: false, ingredientName: "Monster Negro (pza)", packSize: 12, category: "Energizantes" },
  { menuName: "Monster Tapa Verde", sku: "BEV-MON-GREEN", price: 30, requiresPrep: false, ingredientName: "Monster Tapa Verde (pza)", packSize: 12, category: "Energizantes" },
  // Red Bull $30
  { menuName: "Red Bull Regular", sku: "BEV-RB-REG", price: 30, requiresPrep: false, match: "Red Bull Energy Drink", ingredientName: "Red Bull Regular (pza)", packSize: 4, category: "Energizantes" },
  { menuName: "Red Bull Tropical", sku: "BEV-RB-TROP", price: 30, requiresPrep: false, match: "Red Bull Tropical", ingredientName: "Red Bull Tropical (pza)", packSize: 4, category: "Energizantes" },
  // Otros $30
  { menuName: "Topochico", sku: "BEV-TOPO", price: 30, requiresPrep: false, ingredientName: "Topochico (pza)", packSize: 12, category: "Agua / otros" },
  { menuName: "Snapple Durazno", sku: "BEV-SNAP-DUR", price: 30, requiresPrep: false, match: "Snapple Diet Durazno", ingredientName: "Snapple Durazno (pza)", packSize: 12, category: "Agua / otros" },
  { menuName: "Snapple Limón", sku: "BEV-SNAP-LIM", price: 30, requiresPrep: false, match: "Snapple Diet Limón", ingredientName: "Snapple Limón (pza)", packSize: 12, category: "Agua / otros" },
  { menuName: "Snapple Frambuesa", sku: "BEV-SNAP-FRA", price: 30, requiresPrep: false, match: "Snapple Diet Frambuesa", ingredientName: "Snapple Frambuesa (pza)", packSize: 12, category: "Agua / otros" },
  // Especiales
  { menuName: "Agua Ciel", sku: "BEV-CIEL", price: 25, requiresPrep: false, ingredientName: "Agua Ciel (pza)", packSize: 24, category: "Agua / otros" },
  { menuName: "Limonada natural", sku: "BEV-LIMONADA", price: 50, requiresPrep: true, ingredientName: "Limonada natural (prep)", packSize: undefined, category: "Preparadas" },
  { menuName: "Piñada", sku: "BEV-PINADA", price: 80, requiresPrep: true, ingredientName: "Piñada (prep)", packSize: undefined, category: "Preparadas" },
];

const PREP_ITEMS: Array<{
  name: string;
  unit: UnitType;
  category: string;
  storageNote?: string;
}> = [
  { name: "Carne hamburguesa americana", unit: "KG", category: "Producción" },
  { name: "Carne hamburguesa de res", unit: "KG", category: "Producción" },
  { name: "Salsa pomodoro", unit: "L", category: "Producción" },
  { name: "Pico de gallo", unit: "KG", category: "Producción" },
  { name: "Guacamole", unit: "KG", category: "Producción" },
  { name: "Dedos de queso (prep)", unit: "UNIT", category: "Producción" },
  { name: "Cebolla caramelizada", unit: "KG", category: "Producción" },
  { name: "Salsa italiana", unit: "L", category: "Producción" },
  { name: "Tocino cocido", unit: "KG", category: "Producción" },
  {
    name: "Nachos (totopo)",
    unit: "KG",
    category: "Producción",
    storageNote: "Totopos para nachos",
  },
  {
    name: "Salchichas de sampler",
    unit: "UNIT",
    category: "Producción",
    storageNote: "Salchichas envueltas en tortilla de harina",
  },
];

const FROZEN_MATCHES = ["boneless", "papas", "camote", "mcCain", "mccain"];

/** Salsas / aderezos comprados — Custom Culinary (modificadores boneless, etc.) */
const CUSTOM_CULINARY_SAUCES: Array<{
  name: string;
  unit: UnitType;
}> = [
  { name: "Salsa BBQ", unit: "L" },
  { name: "Salsa Buffalo", unit: "L" },
  { name: "Salsa BBQ Hot", unit: "L" },
  { name: "Salsa Mango Habanero", unit: "L" },
  { name: "Aderezo Ranch", unit: "L" },
  { name: "Aderezo Blue Cheese", unit: "L" },
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
      notes: "Proveedor de salsas y aderezos",
      active: true,
    },
  });
}

async function ensureLocation() {
  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay location activa. Corre npm run db:seed");
  return location;
}

async function normalizeBoxedToPieces(
  locationId: string,
  boxed: { id: string; name: string; currentStock: { toString(): string }; averageCost: { toString(): string }; baseUnit: UnitType },
  sellName: string,
  packSize: number,
) {
  const boxes = Number(boxed.currentStock);
  const pieces = Math.round(boxes * packSize * 10000) / 10000;
  const costPerPiece =
    packSize > 0 ? Number(boxed.averageCost) / packSize : Number(boxed.averageCost);

  // Prefer updating the boxed row in place to UNIT pieces (keeps history).
  if (boxed.baseUnit === "BOX" || boxed.name.toLowerCase().includes("caja")) {
    await prisma.ingredient.update({
      where: { id: boxed.id },
      data: {
        name: sellName,
        kind: IngredientKind.PACKAGED,
        baseUnit: UnitType.UNIT,
        packSize,
        currentStock: pieces,
        averageCost: costPerPiece,
        category: "Bebidas",
        storageNote: `Normalizado desde cajas (packSize=${packSize})`,
      },
    });
    return boxed.id;
  }

  const existing = await prisma.ingredient.findFirst({
    where: { locationId, name: sellName },
  });
  if (existing) {
    await prisma.ingredient.update({
      where: { id: existing.id },
      data: {
        kind: IngredientKind.PACKAGED,
        baseUnit: UnitType.UNIT,
        packSize,
        category: "Bebidas",
      },
    });
    return existing.id;
  }

  const created = await prisma.ingredient.create({
    data: {
      locationId,
      name: sellName,
      category: "Bebidas",
      kind: IngredientKind.PACKAGED,
      baseUnit: UnitType.UNIT,
      packSize,
      currentStock: 0,
      minimumStock: 12,
      averageCost: costPerPiece,
      active: true,
    },
  });
  return created.id;
}

async function main() {
  console.log("Seeding menú bebidas + clasificación cocina…");
  const location = await ensureLocation();

  const category = await prisma.menuCategory.upsert({
    where: {
      // MenuCategory has no unique on name — find then create
      id:
        (
          await prisma.menuCategory.findFirst({
            where: { locationId: location.id, name: "Bebidas" },
          })
        )?.id ?? "seed-cat-bebidas",
    },
    create: {
      id: "seed-cat-bebidas",
      locationId: location.id,
      name: "Bebidas",
      description: "Refrescos, jugos y bebidas preparadas",
      sortOrder: 50,
      active: true,
    },
    update: { active: true, name: "Bebidas" },
  });

  const allIngredients = await prisma.ingredient.findMany({
    where: { locationId: location.id },
  });

  for (const drink of DRINKS) {
    let ingredientId: string | null = null;

    if (drink.match) {
      const match = allIngredients.find((i) =>
        i.name.toLowerCase().includes(drink.match!.toLowerCase()),
      );
      if (match && drink.packSize) {
        ingredientId = await normalizeBoxedToPieces(
          location.id,
          match,
          drink.ingredientName,
          drink.packSize,
        );
      } else if (match) {
        await prisma.ingredient.update({
          where: { id: match.id },
          data: {
            kind: drink.requiresPrep ? IngredientKind.PREP : IngredientKind.PACKAGED,
            name: drink.ingredientName,
            category: "Bebidas",
          },
        });
        ingredientId = match.id;
      }
    }

    if (!ingredientId) {
      const byName = await prisma.ingredient.findFirst({
        where: { locationId: location.id, name: drink.ingredientName },
      });
      if (byName) {
        ingredientId = byName.id;
        await prisma.ingredient.update({
          where: { id: byName.id },
          data: {
            kind: drink.requiresPrep ? IngredientKind.PREP : IngredientKind.PACKAGED,
            packSize: drink.packSize ?? byName.packSize,
            baseUnit: drink.requiresPrep ? byName.baseUnit : UnitType.UNIT,
            category: "Bebidas",
          },
        });
      } else {
        const created = await prisma.ingredient.create({
          data: {
            locationId: location.id,
            name: drink.ingredientName,
            category: "Bebidas",
            kind: drink.requiresPrep ? IngredientKind.PREP : IngredientKind.PACKAGED,
            baseUnit: UnitType.UNIT,
            packSize: drink.packSize ?? null,
            currentStock: 0,
            minimumStock: drink.requiresPrep ? 0 : 12,
            averageCost: 0,
            active: true,
          },
        });
        ingredientId = created.id;
      }
    }

    const existingItem = await prisma.menuItem.findFirst({
      where: { locationId: location.id, sku: drink.sku },
    });

    const menuItem = existingItem
      ? await prisma.menuItem.update({
          where: { id: existingItem.id },
          data: {
            name: drink.menuName,
            price: drink.price,
            categoryId: category.id,
            available: true,
            active: true,
            requiresPrep: drink.requiresPrep,
            taxRate: 0.16,
          },
        })
      : await prisma.menuItem.create({
          data: {
            locationId: location.id,
            categoryId: category.id,
            name: drink.menuName,
            sku: drink.sku,
            price: drink.price,
            taxRate: 0.16,
            available: true,
            active: true,
            requiresPrep: drink.requiresPrep,
            tags: [drink.category, "bebida"],
          },
        });

    await prisma.recipeItem.upsert({
      where: {
        menuItemId_ingredientId: {
          menuItemId: menuItem.id,
          ingredientId,
        },
      },
      create: {
        menuItemId: menuItem.id,
        ingredientId,
        quantity: 1,
        unit: UnitType.UNIT,
      },
      update: { quantity: 1, unit: UnitType.UNIT },
    });

    console.log(`✓ ${drink.menuName} → $${drink.price}`);
  }

  // Classify frozen
  const refreshed = await prisma.ingredient.findMany({
    where: { locationId: location.id },
  });
  for (const ing of refreshed) {
    const n = ing.name.toLowerCase();
    if (FROZEN_MATCHES.some((m) => n.includes(m.toLowerCase()))) {
      await prisma.ingredient.update({
        where: { id: ing.id },
        data: {
          kind: IngredientKind.FROZEN,
          storageNote: "Congelado 100% (compra)",
          category: ing.category ?? "Congelados",
        },
      });
      console.log(`❄ FROZEN: ${ing.name}`);
    }
  }

  // Prep production ingredients
  for (const prep of PREP_ITEMS) {
    const existing = await prisma.ingredient.findFirst({
      where: { locationId: location.id, name: prep.name },
    });
    const ingredient = existing
      ? await prisma.ingredient.update({
          where: { id: existing.id },
          data: {
            kind: IngredientKind.PREP,
            category: prep.category,
            storageNote: prep.storageNote ?? "Producción interna",
            baseUnit: prep.unit,
          },
        })
      : await prisma.ingredient.create({
          data: {
            locationId: location.id,
            name: prep.name,
            category: prep.category,
            kind: IngredientKind.PREP,
            baseUnit: prep.unit,
            currentStock: 0,
            minimumStock: 0,
            averageCost: 0,
            storageNote: prep.storageNote ?? "Producción interna",
            active: true,
          },
        });

    const recipe = await prisma.prepRecipe.upsert({
      where: { outputIngredientId: ingredient.id },
      create: {
        locationId: location.id,
        outputIngredientId: ingredient.id,
        outputQuantity: 1,
        notes: "Completar insumos con recetario del local",
        active: true,
      },
      update: { active: true, notes: "Completar insumos con recetario del local" },
    });

    // Placeholder: if a similarly named RAW exists, link lightly — skip empty
    console.log(`🍳 PREP: ${ingredient.name} (recipe ${recipe.id.slice(0, 8)})`);
  }

  // Mark limonada/piñada ingredients as PREP
  for (const name of ["Limonada natural (prep)", "Piñada (prep)"]) {
    await prisma.ingredient.updateMany({
      where: { locationId: location.id, name },
      data: { kind: IngredientKind.PREP, storageNote: "Bebida preparada" },
    });
  }

  // Salsas Custom Culinary (compra, no producción)
  const customCulinary = await upsertSupplier(location.id, "Custom Culinary");
  for (const sauce of CUSTOM_CULINARY_SAUCES) {
    const existing = await prisma.ingredient.findFirst({
      where: { locationId: location.id, name: sauce.name },
    });
    if (existing) {
      await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          kind: IngredientKind.PACKAGED,
          category: "Salsas",
          baseUnit: sauce.unit,
          preferredSupplierId: customCulinary.id,
          storageNote: "Proveedor: Custom Culinary",
          active: true,
        },
      });
    } else {
      await prisma.ingredient.create({
        data: {
          locationId: location.id,
          name: sauce.name,
          category: "Salsas",
          kind: IngredientKind.PACKAGED,
          baseUnit: sauce.unit,
          currentStock: 0,
          minimumStock: 1,
          averageCost: 0,
          preferredSupplierId: customCulinary.id,
          storageNote: "Proveedor: Custom Culinary",
          active: true,
        },
      });
    }
    console.log(`🥫 ${sauce.name} → Custom Culinary`);
  }

  console.log("Listo · bebidas + kinds.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
