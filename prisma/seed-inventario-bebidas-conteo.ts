import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { inventoryService } from "../src/services/inventory.service";

/**
 * Conteo físico 18-oct-2026 — Inventario_Bebidas_The_Pub_Alena_Sur.md
 * Solo líneas con match confirmado. Existencia = Total (absoluto).
 */

const prisma = new PrismaClient();

type Line = {
  sheetName: string;
  ingredientName: string;
  quantity: number;
};

/** Matches unívocos — se cargan ya. */
const CONFIRMED: Line[] = [
  { sheetName: "Topo Chico", ingredientName: "Topochico (pza)", quantity: 17 },
  { sheetName: "Snapple limón", ingredientName: "Snapple Limón (pza)", quantity: 11 },
  { sheetName: "Snapple durazno", ingredientName: "Snapple Durazno (pza)", quantity: 8 },
  { sheetName: "Snapple frambuesa", ingredientName: "Snapple Frambuesa (pza)", quantity: 10 },
  { sheetName: "Boing uva", ingredientName: "Boing Uva (pza)", quantity: 11 },
  { sheetName: "Boing guayaba", ingredientName: "Boing Guayaba (pza)", quantity: 17 },
  { sheetName: "Boing mango", ingredientName: "Boing Mango (pza)", quantity: 17 },
  { sheetName: "Boing fresa", ingredientName: "Boing Fresa (pza)", quantity: 26 },
  { sheetName: "Coca-Cola regular", ingredientName: "Coca-Cola Regular (pza)", quantity: 24 },
  { sheetName: "Coca-Cola Light", ingredientName: "Coca-Cola Light (pza)", quantity: 30 },
  { sheetName: "Coca-Cola Zero", ingredientName: "Coca-Cola Zero (pza)", quantity: 21 },
  { sheetName: "Fresca", ingredientName: "Fresca (pza)", quantity: 6 },
  { sheetName: "Fanta", ingredientName: "Fanta (pza)", quantity: 10 },
  { sheetName: "Agua Ciel", ingredientName: "Agua Ciel (pza)", quantity: 16 },
  { sheetName: "Monster Zero (blanco)", ingredientName: "Monster Blanco (pza)", quantity: 11 },
  { sheetName: "Peñafiel toronja", ingredientName: "Peñafielada Toronja (pza)", quantity: 19 },
  { sheetName: "Peñafiel fresa", ingredientName: "Peñafielada Fresa (pza)", quantity: 15 },
  { sheetName: "Peñafiel limón", ingredientName: "Peñafielada Limón (pza)", quantity: 33 },
  { sheetName: "Peñafiel naranja", ingredientName: "Peñafielada Naranjada (pza)", quantity: 15 },
  { sheetName: "Dr Pepper normal", ingredientName: "Dr Pepper Regular (pza)", quantity: 24 },
  { sheetName: "Dr Pepper Cream Soda", ingredientName: "Dr Pepper Cream (pza)", quantity: 11 },
  { sheetName: "Dr Pepper Cherry", ingredientName: "Dr Pepper Cherry (pza)", quantity: 16 },
  { sheetName: "Dr Pepper Light", ingredientName: "Dr Pepper Light (pza)", quantity: 11 },
];

async function main() {
  console.log(`Conteo bebidas · ${CONFIRMED.length} líneas confirmadas…`);

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

  let ok = 0;
  let missing: string[] = [];

  for (const line of CONFIRMED) {
    const ingredient = await prisma.ingredient.findFirst({
      where: {
        locationId: location.id,
        name: { equals: line.ingredientName, mode: "insensitive" },
        active: true,
      },
    });
    if (!ingredient) {
      missing.push(`${line.sheetName} → ${line.ingredientName}`);
      continue;
    }

    const current = Number(ingredient.currentStock);
    if (current === line.quantity) {
      console.log(`= ${line.ingredientName} ya en ${line.quantity}`);
      ok += 1;
      continue;
    }

    try {
      await inventoryService.setStockAbsolute({
        ingredientId: ingredient.id,
        newStock: line.quantity,
        employeeId: admin?.id ?? null,
        notes: `Conteo físico bebidas 18-oct-2026 · ${line.sheetName}`,
      });
      console.log(
        `✓ ${line.ingredientName}: ${current} → ${line.quantity}`,
      );
      ok += 1;
    } catch (e) {
      console.error(`✗ ${line.ingredientName}`, e);
    }
  }

  console.log(`Listo · ajustados/ok=${ok} faltantes=${missing.length}`);
  if (missing.length) console.log(missing.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
