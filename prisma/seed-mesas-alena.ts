import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  FLOOR_TABLE_CODES,
  defaultJoinPairs,
} from "../src/lib/table-floor";

/**
 * Piso Alena Sur: 32 mitades (10-13 … 80-83).
 * Por defecto: 10 juntada a 11, 13 juntada a 12 (se ven como 11 | 12).
 * Se pueden separar (11→10+11, 12→12+13) y juntar el pasillo (11+12).
 */

const prisma = new PrismaClient();

async function main() {
  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay sucursal activa.");

  const old = await prisma.restaurantTable.updateMany({
    where: {
      locationId: location.id,
      name: { startsWith: "Mesa " },
    },
    data: { active: false, joinedToId: null },
  });

  let created = 0;
  let updated = 0;
  const byCode = new Map<number, string>();

  for (const code of FLOOR_TABLE_CODES) {
    const name = String(code);
    const existing = await prisma.restaurantTable.findUnique({
      where: {
        locationId_name: { locationId: location.id, name },
      },
    });

    if (existing) {
      const busy =
        existing.status === "OCCUPIED" ||
        existing.status === "AWAITING_PAYMENT";
      await prisma.restaurantTable.update({
        where: { id: existing.id },
        data: {
          active: true,
          capacity: 2,
          sortOrder: code,
          joinedToId: null,
          status: busy ? existing.status : "AVAILABLE",
        },
      });
      byCode.set(code, existing.id);
      updated += 1;
    } else {
      const row = await prisma.restaurantTable.create({
        data: {
          locationId: location.id,
          name,
          capacity: 2,
          sortOrder: code,
          status: "AVAILABLE",
          active: true,
        },
      });
      byCode.set(code, row.id);
      created += 1;
    }
  }

  // Clear joins on any leftover floor names not in the new set (old 11-82 only set)
  // Default half-pair joins (skip if primary is busy with open logic — seed clears joins first)
  let joins = 0;
  for (const [satelliteCode, primaryCode] of defaultJoinPairs()) {
    const satelliteId = byCode.get(satelliteCode);
    const primaryId = byCode.get(primaryCode);
    if (!satelliteId || !primaryId) continue;
    await prisma.restaurantTable.update({
      where: { id: satelliteId },
      data: { joinedToId: primaryId },
    });
    joins += 1;
  }

  console.log(
    `Mesas Alena · nuevas=${created} actualizadas=${updated} · joins default=${joins} · desactivadas "Mesa N"=${old.count}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
