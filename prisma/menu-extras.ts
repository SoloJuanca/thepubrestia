import type { PrismaClient } from "@prisma/client";

const SAUCES = [
  "Ranch",
  "Blue cheese",
  "BBQ",
  "Buffalo",
  "BBQ hot",
  "Mango habanero",
  "Queso amarillo",
  "Pepinillos",
  "Chile en vinagre",
] as const;

const SKIP =
  /postre|bebida|cerveza|coctel|cóctel|vino|cafe|café|drink|licor|tequila|mezcal|ron|agua|refresco|jugo|cocktail/i;

type OptionInput = { name: string; price: number };

async function upsertGroup(
  prisma: PrismaClient,
  menuItemId: string,
  group: {
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    options: OptionInput[];
  },
) {
  const existing = await prisma.modifierGroup.findFirst({
    where: { menuItemId, name: group.name },
    include: { options: true },
  });

  if (!existing) {
    if (group.sortOrder === 0) {
      await prisma.modifierGroup.updateMany({
        where: { menuItemId },
        data: { sortOrder: { increment: 1 } },
      });
    }
    await prisma.modifierGroup.create({
      data: {
        menuItemId,
        name: group.name,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
        options: {
          create: group.options.map((option, index) => ({
            name: option.name,
            priceDelta: option.price,
            active: true,
            sortOrder: index,
          })),
        },
      },
    });
    return "created" as const;
  }

  await prisma.modifierGroup.update({
    where: { id: existing.id },
    data: {
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      sortOrder: group.sortOrder === 0 ? 0 : existing.sortOrder,
    },
  });

  for (const [index, option] of group.options.entries()) {
    const current = existing.options.find(
      (row) => row.name.toLowerCase() === option.name.toLowerCase(),
    );
    if (current) {
      await prisma.modifierOption.update({
        where: { id: current.id },
        data: {
          name: option.name,
          priceDelta: option.price,
          active: true,
          sortOrder: index,
        },
      });
    } else {
      await prisma.modifierOption.create({
        data: {
          modifierGroupId: existing.id,
          name: option.name,
          priceDelta: option.price,
          active: true,
          sortOrder: index,
        },
      });
    }
  }
  return "updated" as const;
}

const HALF_HALF_GROUPS = [
  /^salsa$/i,
  /^salsa boneless$/i,
  /^preparaci[oó]n$/i,
];

/** Allow 1 or 2 picks so kitchen can do mitad y mitad. */
async function enableHalfAndHalf(
  prisma: PrismaClient,
  menuItemId: string,
) {
  const groups = await prisma.modifierGroup.findMany({
    where: { menuItemId },
  });
  let updated = 0;
  for (const group of groups) {
    if (!HALF_HALF_GROUPS.some((pattern) => pattern.test(group.name))) continue;
    if (group.maxSelections >= 2 && group.minSelections >= 1) continue;
    await prisma.modifierGroup.update({
      where: { id: group.id },
      data: {
        required: true,
        minSelections: Math.max(1, group.minSelections),
        maxSelections: Math.max(2, group.maxSelections),
      },
    });
    updated += 1;
  }
  return updated;
}

/** Extra sauce on savory dishes, and flour/corn tortilla on quesadillas. */
export async function applyMenuExtras(prisma: PrismaClient, locationId?: string) {
  const items = await prisma.menuItem.findMany({
    where: locationId ? { locationId } : undefined,
    include: { category: true },
  });

  let sauces = 0;
  let tortillas = 0;
  let halfAndHalf = 0;

  for (const item of items) {
    const context = `${item.category.name} ${item.category.description ?? ""} ${item.tags.join(" ")} ${item.name}`;
    if (!SKIP.test(context)) {
      await upsertGroup(prisma, item.id, {
        name: "Aderezo adicional",
        required: false,
        minSelections: 0,
        maxSelections: SAUCES.length,
        sortOrder: 50,
        options: SAUCES.map((name) => ({ name, price: 15 })),
      });
      sauces += 1;
    }

    if (/quesadilla/i.test(item.name)) {
      await upsertGroup(prisma, item.id, {
        name: "Tortilla",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 0,
        options: [
          { name: "Harina", price: 0 },
          { name: "Maíz", price: 0 },
        ],
      });
      tortillas += 1;
    }

    // Boneless (incl. hamburguesa/sampler) y quesadillas: 1 o 2 sabores.
    if (/boneless|quesadilla|sampler/i.test(item.name)) {
      halfAndHalf += await enableHalfAndHalf(prisma, item.id);
    }
  }

  return { items: items.length, sauces, tortillas, halfAndHalf };
}
