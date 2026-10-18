import "dotenv/config";
import { IngredientKind, PrismaClient, UnitType } from "@prisma/client";

/**
 * Fuente: Inventario_Pedidos_The_Pub_Alena_Sur.md
 * (HOJA DE INVENTARIO PARA PEDIDO ALENASUR)
 *
 * Existencia vacía en el PDF → no se inventa stock.
 * CARNES / VERDURAS → Grasan
 * CIEMSA → Ciemsa
 * CREMERIA Y ABARROTES → Grasan (abarrotes)
 * SIGMA → Sigma
 */

const prisma = new PrismaClient();

type SheetLine = {
  category: string;
  name: string;
  minimumStock: number | null;
  targetStock: number | null;
  unitRaw: string | null;
  /** Nombres ya sembrados que equivalen a este renglón */
  aliases?: string[];
};

const LINES: SheetLine[] = [
  // CARNES → Grasan
  { category: "CARNES", name: "MILANESA DE RES", minimumStock: 1, targetStock: 2, unitRaw: "KG" },
  { category: "CARNES", name: "MOLIDA DE RES 80/20", minimumStock: 1, targetStock: 6, unitRaw: "KG" },
  { category: "CARNES", name: "MILANESA DE POLLO", minimumStock: 1, targetStock: 2, unitRaw: "KG" },
  { category: "CARNES", name: "TOCINO REBANADO", minimumStock: 1, targetStock: 2, unitRaw: "KG" },
  // VERDURAS → Grasan
  { category: "VERDURAS", name: "LIMON SIN SEMILLA", minimumStock: 1, targetStock: 10, unitRaw: "KG" },
  { category: "VERDURAS", name: "CEBOLLA BLANCA", minimumStock: 1, targetStock: 3, unitRaw: "KG" },
  { category: "VERDURAS", name: "CEBOLLA MORADA", minimumStock: 0.5, targetStock: 2, unitRaw: "KG" },
  { category: "VERDURAS", name: "ZANAHORIA", minimumStock: 1, targetStock: 2, unitRaw: "KG" },
  { category: "VERDURAS", name: "APIO", minimumStock: 1, targetStock: 2, unitRaw: "KG" },
  { category: "VERDURAS", name: "LECHUGA ITALIANA", minimumStock: 1, targetStock: 2, unitRaw: "KG" },
  { category: "VERDURAS", name: "JITOMATE SALADET", minimumStock: 1, targetStock: 3, unitRaw: "KG" },
  { category: "VERDURAS", name: "JITOMATE BOLA", minimumStock: 1, targetStock: 2, unitRaw: "KG" },
  { category: "VERDURAS", name: "CHILE JALAPEÑO", minimumStock: 0.5, targetStock: 1, unitRaw: "KG" },
  { category: "VERDURAS", name: "PEREJIL", minimumStock: 2, targetStock: 4, unitRaw: "MANOJO" },
  { category: "VERDURAS", name: "AJO", minimumStock: 0.5, targetStock: 1, unitRaw: "KG" },
  // CIEMSA
  {
    category: "CIEMSA",
    name: "PAPA MCCAIN FLAVOR LAST 3/8",
    minimumStock: 1,
    targetStock: 4,
    unitRaw: "CAJA",
    aliases: ["McCain Papa Flavorlast 3/8 sin cáscara cobertura XL"],
  },
  {
    category: "CIEMSA",
    name: "CAMOTE MCCAIN",
    minimumStock: 1,
    targetStock: 2,
    unitRaw: "CAJA",
    aliases: ["McCain Papa Camote (caja 6x2.5 lb)"],
  },
  {
    category: "CIEMSA",
    name: "BONELESS NATURALES PILGRIM",
    minimumStock: 1,
    targetStock: 2,
    unitRaw: "CAJA",
    aliases: ["Boneless naturales Pilgrim's (caja 6x2 kg)"],
  },
  {
    category: "CIEMSA",
    name: "QUESO MONTERREY JACK RALLADO",
    minimumStock: 2,
    targetStock: 6,
    unitRaw: "BOLSA",
  },
  {
    category: "CIEMSA",
    name: "QUESO PARMESANO RALLADO",
    minimumStock: 1,
    targetStock: 2,
    unitRaw: "BOLSA",
    aliases: ["Queso Parmesano rallado fino bolsa 5 lb"],
  },
  {
    category: "CIEMSA",
    name: "QUESO CHEDDAR REBANADO",
    minimumStock: 1,
    targetStock: 2,
    unitRaw: "PAQUETE",
    aliases: ["Queso Mild Cheddar rebanado 1.5 lb"],
  },
  {
    category: "CIEMSA",
    name: "QUESO PROVOLONE REBANADO",
    minimumStock: 1,
    targetStock: 2,
    unitRaw: "PAQUETE",
    aliases: ["Queso Provolone natural rebanado 1.5 lb"],
  },
  {
    category: "CIEMSA",
    name: "QUESO PEPPERJACK EN BARRA",
    minimumStock: 1,
    targetStock: 2,
    unitRaw: "PZA",
    aliases: ["Queso Pepper Jack barra 5 lb"],
  },
  {
    category: "CIEMSA",
    name: "QUESO CHEDDAR LIQUIDO",
    minimumStock: 1,
    targetStock: 3,
    unitRaw: "PZA",
  },
  {
    category: "CIEMSA",
    name: "CATSUP POUCH BOLSA",
    minimumStock: 1,
    targetStock: 4,
    unitRaw: "PZA",
  },
  {
    category: "CIEMSA",
    name: "QUESO AZUL RUEDA",
    minimumStock: 0.25,
    targetStock: 1,
    unitRaw: "PZA",
  },
  {
    category: "CIEMSA",
    name: "ACEITE DE FREIDO PROFUNDO",
    minimumStock: 1,
    targetStock: 2,
    unitRaw: "BIDON",
  },
  {
    category: "CIEMSA",
    name: "BOLLO BRIOCHE MANTEQUILLA",
    minimumStock: 1,
    targetStock: 2,
    unitRaw: "CAJA",
    aliases: ["Bollo brioche (caja 30 x 78 g)"],
  },
  {
    category: "CIEMSA",
    name: "MOSTAZA HEINZ SOBRE",
    minimumStock: 0.5,
    targetStock: 1,
    unitRaw: "CAJA",
  },
  {
    category: "CIEMSA",
    name: "MAYONESA HEINZ SOBRE",
    minimumStock: 0.5,
    targetStock: 1,
    unitRaw: "CAJA",
  },
  {
    category: "CIEMSA",
    name: "CASTUP HEINZ SOBRE",
    minimumStock: 0.5,
    targetStock: 1,
    unitRaw: "CAJA",
    aliases: ["Ketchup sobre Mex Heinz (caja 1000 x 9 g)"],
  },
  {
    category: "CIEMSA",
    name: "CHILE QUEBRADO HEINZ SOBRE",
    minimumStock: 0.5,
    targetStock: 1,
    unitRaw: "CAJA",
  },
  // CREMERIA Y ABARROTES → Grasan
  { category: "CREMERIA Y ABARROTES", name: "QUESO MANCHEGO", minimumStock: 2, targetStock: 8, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "MAYONESA", minimumStock: 0.5, targetStock: 1, unitRaw: "GALON" },
  { category: "CREMERIA Y ABARROTES", name: "MOSTAZA", minimumStock: 1, targetStock: 2, unitRaw: "GALON" },
  { category: "CREMERIA Y ABARROTES", name: "TORTILLA DE HARINA", minimumStock: 2, targetStock: 10, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "TORTILLA DE MAIZ", minimumStock: 2, targetStock: 6, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "LECHERA", minimumStock: 2, targetStock: 8, unitRaw: "PZA" },
  { category: "CREMERIA Y ABARROTES", name: "CLAVEL", minimumStock: 2, targetStock: 8, unitRaw: "PZA" },
  { category: "CREMERIA Y ABARROTES", name: "ACEITE VEGETAL", minimumStock: 0.5, targetStock: 1, unitRaw: "GALON" },
  { category: "CREMERIA Y ABARROTES", name: "VINAGRE BLANCO", minimumStock: 1, targetStock: 2, unitRaw: "GALON" },
  { category: "CREMERIA Y ABARROTES", name: "AZUCAR REFINADA", minimumStock: 1, targetStock: 2, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "CANELA MOLIDA", minimumStock: 0.1, targetStock: 0.5, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "CONTENEDOR 7X7 LISO", minimumStock: 1, targetStock: 2, unitRaw: "PZA" },
  { category: "CREMERIA Y ABARROTES", name: "BOTE DE 1 LT TRANSPARENTE", minimumStock: 1, targetStock: 2, unitRaw: "PAQ" },
  { category: "CREMERIA Y ABARROTES", name: "TAZON DE 1/2 LT TRANSPARENTE", minimumStock: 1, targetStock: 2, unitRaw: "PAQ" },
  { category: "CREMERIA Y ABARROTES", name: "BOLSA 60X90", minimumStock: 2, targetStock: 3, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "BOLSA 90X120", minimumStock: 2, targetStock: 3, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "BOLSA 1KG ROLLO", minimumStock: 1, targetStock: 2, unitRaw: "PZA" },
  { category: "CREMERIA Y ABARROTES", name: "BOLSA 5 KG ROLLO", minimumStock: 1, targetStock: 2, unitRaw: "PZA" },
  { category: "CREMERIA Y ABARROTES", name: "EGAPACK (PLAYO)", minimumStock: 0.5, targetStock: 1, unitRaw: "ROLLO" },
  { category: "CREMERIA Y ABARROTES", name: "ALUMINIO", minimumStock: 0.5, targetStock: 1, unitRaw: "ROLLO" },
  { category: "CREMERIA Y ABARROTES", name: "VASO 4 CH PLASTICO", minimumStock: 1, targetStock: 2, unitRaw: "PAQ" },
  { category: "CREMERIA Y ABARROTES", name: "TAPA VASO 4 CH PLASTICO", minimumStock: 1, targetStock: 2, unitRaw: "PAQ" },
  { category: "CREMERIA Y ABARROTES", name: "TAPA PARA BOTE DE 1 LT TRANSPARENTE", minimumStock: 1, targetStock: 2, unitRaw: "PAQ" },
  { category: "CREMERIA Y ABARROTES", name: "PAPEL AJEDREZ AZUL REY", minimumStock: 0.5, targetStock: 1, unitRaw: "MILLAR" },
  { category: "CREMERIA Y ABARROTES", name: "HARINA HOJA DE PLATA", minimumStock: 1, targetStock: 2, unitRaw: "BULTO 10 KG" },
  { category: "CREMERIA Y ABARROTES", name: "PULPA DE TOMATE PARA PIZZA", minimumStock: 1, targetStock: 2, unitRaw: "BOLSA 5 KG" },
  { category: "CREMERIA Y ABARROTES", name: "LEVADURA EN POLVO", minimumStock: 0.5, targetStock: 1, unitRaw: "PAQ" },
  { category: "CREMERIA Y ABARROTES", name: "SAL FINA", minimumStock: 1, targetStock: 3, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "PIMIENTA NEGRA EN POLVO", minimumStock: 0.25, targetStock: 0.5, unitRaw: "KG" },
  { category: "CREMERIA Y ABARROTES", name: "PLATANO TABASCO", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "JUGO DE NARANJA UNICO FRESCO JUMEX", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "JUGO DE PIÑA JUMEX", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "CREMA DE COCO CALAHUA", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "NUEZ", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "ALMENDRA", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "CAJETA", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "MERMELADA DE FRESA", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "MERMELADA DE ZARZAMORA", minimumStock: null, targetStock: null, unitRaw: null },
  { category: "CREMERIA Y ABARROTES", name: "MERMELADA DE FRAMBUESA", minimumStock: null, targetStock: null, unitRaw: null },
  // SIGMA
  {
    category: "SIGMA",
    name: "NUTELLA",
    minimumStock: null,
    targetStock: null,
    unitRaw: null,
    aliases: ["Crema de avellana 950 g Nutella"],
  },
  {
    category: "SIGMA",
    name: "SALAMI",
    minimumStock: null,
    targetStock: null,
    unitRaw: null,
    aliases: ["Salami Tangamanga"],
  },
  {
    category: "SIGMA",
    name: "PEPPERONI",
    minimumStock: null,
    targetStock: null,
    unitRaw: null,
    aliases: ["Pepperoni madurado 2.27 kg Azerta"],
  },
  {
    category: "SIGMA",
    name: "SALCHICHA ITALIANA",
    minimumStock: null,
    targetStock: null,
    unitRaw: null,
    aliases: ["Italian Topping 2.27 kg Hormel"],
  },
  {
    category: "SIGMA",
    name: "QUESO PHILADELPHIA",
    minimumStock: null,
    targetStock: null,
    unitRaw: null,
    aliases: ["Queso crema barra 180 g Philadelphia"],
  },
  {
    category: "SIGMA",
    name: "MANTEQUILLA NOCHE BUENA",
    minimumStock: null,
    targetStock: null,
    unitRaw: null,
    aliases: ["Mantequilla 1 kg NocheBuena"],
  },
  {
    category: "SIGMA",
    name: "SPAGHETTI BARILLA",
    minimumStock: null,
    targetStock: null,
    unitRaw: null,
  },
  {
    category: "SIGMA",
    name: "SALCHICHA PARA HOTDOG",
    minimumStock: null,
    targetStock: null,
    unitRaw: null,
    aliases: ["Salchicha hot dog 3 kg Fud"],
  },
];

/** Title Case for display while keeping sheet identity. */
function displayName(sheetName: string) {
  return sheetName
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bPara\b/g, "para")
    .replace(/\bEn\b/g, "en")
    .replace(/\bY\b/g, "y")
    .replace(/\b80\/20\b/i, "80/20");
}

function mapUnit(unitRaw: string | null): {
  unit: UnitType;
  storageNote: string | null;
  kind: IngredientKind;
} {
  if (!unitRaw) {
    return { unit: "UNIT", storageNote: null, kind: "RAW" };
  }
  const u = unitRaw.toUpperCase().trim();
  if (u === "KG") return { unit: "KG", storageNote: null, kind: "RAW" };
  if (u === "CAJA") return { unit: "BOX", storageNote: null, kind: "PACKAGED" };
  if (u === "BOLSA" || u === "PAQUETE" || u === "PAQ") {
    return { unit: "PACK", storageNote: null, kind: "PACKAGED" };
  }
  if (u === "PZA") return { unit: "UNIT", storageNote: null, kind: "PACKAGED" };
  if (u === "MANOJO") {
    return { unit: "UNIT", storageNote: "Manojo", kind: "RAW" };
  }
  if (u === "GALON") {
    return { unit: "L", storageNote: "Galón", kind: "PACKAGED" };
  }
  if (u === "BIDON") {
    return { unit: "UNIT", storageNote: "Bidón", kind: "PACKAGED" };
  }
  if (u === "ROLLO") {
    return { unit: "UNIT", storageNote: "Rollo", kind: "PACKAGED" };
  }
  if (u === "MILLAR") {
    return { unit: "UNIT", storageNote: "Millar", kind: "PACKAGED" };
  }
  if (u.startsWith("BULTO")) {
    return { unit: "BOX", storageNote: unitRaw, kind: "PACKAGED" };
  }
  if (u.startsWith("BOLSA")) {
    return { unit: "PACK", storageNote: unitRaw, kind: "PACKAGED" };
  }
  return { unit: "UNIT", storageNote: unitRaw, kind: "PACKAGED" };
}

function supplierNameForCategory(category: string): string {
  switch (category) {
    case "CARNES":
    case "VERDURAS":
    case "CREMERIA Y ABARROTES":
      return "Grasan";
    case "CIEMSA":
      return "Ciemsa";
    case "SIGMA":
      return "Sigma";
    default:
      return "Grasan";
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case "CARNES":
      return "Carnes";
    case "VERDURAS":
      return "Verduras";
    case "CIEMSA":
      return "Ciemsa";
    case "CREMERIA Y ABARROTES":
      return "Cremería y abarrotes";
    case "SIGMA":
      return "Sigma";
    default:
      return category;
  }
}

async function upsertSupplier(locationId: string, name: string) {
  const existing = await prisma.supplier.findFirst({
    where: {
      locationId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: { name, active: true },
    });
  }
  // Grasan was previously "Grasan (Abarrotes)"
  if (name === "Grasan") {
    const grasan = await prisma.supplier.findFirst({
      where: {
        locationId,
        name: { contains: "Grasan", mode: "insensitive" },
      },
    });
    if (grasan) {
      return prisma.supplier.update({
        where: { id: grasan.id },
        data: {
          name: "Grasan",
          notes: "Carnes, verduras, cremería y abarrotes — hoja Alena Sur",
          active: true,
        },
      });
    }
  }
  return prisma.supplier.create({
    data: {
      locationId,
      name,
      notes: `Proveedor hoja pedido Alena Sur · ${name}`,
      active: true,
    },
  });
}

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

type IngRow = {
  id: string;
  name: string;
  currentStock: { toString(): string };
  baseUnit: UnitType;
};

async function main() {
  console.log(
    `Importando hoja Alena Sur (${LINES.length} renglones)…`,
  );

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay sucursal activa.");

  const supplierCache = new Map<string, string>();
  for (const name of ["Grasan", "Ciemsa", "Sigma"]) {
    const s = await upsertSupplier(location.id, name);
    supplierCache.set(name, s.id);
  }

  const existing = await prisma.ingredient.findMany({
    where: { locationId: location.id },
    select: { id: true, name: true, currentStock: true, baseUnit: true },
  });
  const byNorm = new Map<string, IngRow>();
  for (const row of existing) {
    byNorm.set(stripAccents(row.name), row);
  }

  function resolve(line: SheetLine): IngRow | null {
    const candidates = [
      displayName(line.name),
      line.name,
      ...(line.aliases ?? []),
    ];
    for (const c of candidates) {
      const hit = byNorm.get(stripAccents(c));
      if (hit) return hit;
    }
    return null;
  }

  let created = 0;
  let updated = 0;
  const clearStockIds: string[] = [];

  for (const line of LINES) {
    const { unit, storageNote, kind } = mapUnit(line.unitRaw);
    const preferredSupplierId = supplierCache.get(
      supplierNameForCategory(line.category),
    )!;
    const name = displayName(line.name);
    const min = line.minimumStock ?? 0;
    const target = line.targetStock;
    const found = resolve(line);

    let ingredient: IngRow;

    if (found) {
      const stock = Number(found.currentStock.toString());
      ingredient = await prisma.ingredient.update({
        where: { id: found.id },
        data: {
          name,
          category: categoryLabel(line.category),
          kind,
          ...(stock === 0 ? { baseUnit: unit } : {}),
          minimumStock: min,
          targetStock: target,
          preferredSupplierId,
          storageNote,
          active: true,
        },
        select: { id: true, name: true, currentStock: true, baseUnit: true },
      });
      updated += 1;

      if (
        (line.category === "CARNES" || line.category === "VERDURAS") &&
        stock > 0 &&
        stock === (line.minimumStock ?? -1)
      ) {
        clearStockIds.push(found.id);
      }
    } else {
      ingredient = await prisma.ingredient.create({
        data: {
          locationId: location.id,
          name,
          category: categoryLabel(line.category),
          kind,
          baseUnit: unit,
          currentStock: 0,
          minimumStock: min,
          targetStock: target,
          averageCost: 0,
          preferredSupplierId,
          storageNote,
          active: true,
        },
        select: { id: true, name: true, currentStock: true, baseUnit: true },
      });
      created += 1;
    }

    byNorm.set(stripAccents(name), ingredient);

    await prisma.supplierProduct.upsert({
      where: {
        supplierId_ingredientId: {
          supplierId: preferredSupplierId,
          ingredientId: ingredient.id,
        },
      },
      create: {
        supplierId: preferredSupplierId,
        ingredientId: ingredient.id,
        unit,
        unitCost: 0,
        minOrderQty: 1,
        active: true,
      },
      update: {
        unit,
        active: true,
      },
    });
  }

  let stockCleared = 0;
  if (clearStockIds.length > 0) {
    const result = await prisma.ingredient.updateMany({
      where: { id: { in: clearStockIds } },
      data: { currentStock: 0 },
    });
    stockCleared = result.count;
    await prisma.inventoryMovement.deleteMany({
      where: {
        ingredientId: { in: clearStockIds },
        notes: { startsWith: "Carga inicial Grasan" },
      },
    });
  }

  console.log(
    `Listo · nuevos=${created} actualizados=${updated} stock puesto a 0=${stockCleared}`,
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
