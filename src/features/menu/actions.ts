"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import {
  createCategorySchema,
  createMenuItemSchema,
  toggleMenuItemSchema,
  updateCategorySchema,
  updateMenuItemSchema,
  type CreateMenuItemInput,
} from "@/validations/menu";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function emptyToNull(value?: string | null) {
  if (value == null || value === "") return null;
  return value;
}

function revalidateMenu() {
  revalidatePath("/menu");
  revalidatePath("/menu", "layout");
}

async function syncModifierGroups(
  tx: Prisma.TransactionClient,
  menuItemId: string,
  groups: CreateMenuItemInput["modifierGroups"],
) {
  await tx.modifierOption.deleteMany({
    where: { group: { menuItemId } },
  });
  await tx.modifierGroup.deleteMany({ where: { menuItemId } });

  for (const [gIndex, group] of groups.entries()) {
    await tx.modifierGroup.create({
      data: {
        menuItemId,
        name: group.name,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: Math.max(group.maxSelections, group.minSelections || 1),
        sortOrder: group.sortOrder ?? gIndex,
        options: {
          create: group.options.map((opt, oIndex) => ({
            name: opt.name,
            priceDelta: opt.priceDelta,
            active: opt.active,
            sortOrder: opt.sortOrder ?? oIndex,
          })),
        },
      },
    });
  }
}

export async function createCategoryAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("menu", "create");
    const data = createCategorySchema.parse(raw);

    const category = await prisma.menuCategory.create({
      data: {
        locationId: data.locationId,
        name: data.name.trim(),
        description: emptyToNull(data.description),
        imageUrl: emptyToNull(data.imageUrl),
        imagePath: emptyToNull(data.imagePath),
        sortOrder: data.sortOrder,
        active: data.active,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MENU_CATEGORY_CREATE",
        entity: "MenuCategory",
        entityId: category.id,
        after: { name: category.name, active: category.active },
      },
    });

    revalidateMenu();
    return { ok: true, message: "Categoría creada.", id: category.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo crear la categoría." };
  }
}

export async function updateCategoryAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("menu", "update");
    const data = updateCategorySchema.parse(raw);

    const existing = await prisma.menuCategory.findUnique({
      where: { id: data.id },
    });
    if (!existing) return { ok: false, error: "Categoría no encontrada." };

    const category = await prisma.menuCategory.update({
      where: { id: data.id },
      data: {
        name: data.name?.trim(),
        description:
          data.description === undefined
            ? undefined
            : emptyToNull(data.description),
        imageUrl:
          data.imageUrl === undefined ? undefined : emptyToNull(data.imageUrl),
        imagePath:
          data.imagePath === undefined
            ? undefined
            : emptyToNull(data.imagePath),
        sortOrder: data.sortOrder,
        active: data.active,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MENU_CATEGORY_UPDATE",
        entity: "MenuCategory",
        entityId: category.id,
        before: {
          name: existing.name,
          active: existing.active,
          sortOrder: existing.sortOrder,
        },
        after: {
          name: category.name,
          active: category.active,
          sortOrder: category.sortOrder,
        },
      },
    });

    revalidateMenu();
    return { ok: true, message: "Categoría actualizada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo actualizar la categoría." };
  }
}

export async function createMenuItemAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("menu", "create");
    const data = createMenuItemSchema.parse(raw);

    const category = await prisma.menuCategory.findFirst({
      where: { id: data.categoryId, locationId: data.locationId },
    });
    if (!category) {
      return { ok: false, error: "Categoría inválida para la sucursal." };
    }

    const sku = emptyToNull(data.sku);
    if (sku) {
      const clash = await prisma.menuItem.findFirst({
        where: { locationId: data.locationId, sku },
      });
      if (clash) return { ok: false, error: "El SKU ya existe en esta sucursal." };
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          locationId: data.locationId,
          categoryId: data.categoryId,
          name: data.name.trim(),
          description: emptyToNull(data.description),
          sku,
          price: data.price,
          estimatedCost: data.estimatedCost ?? null,
          taxRate: data.taxRate,
          imageUrl: emptyToNull(data.imageUrl),
          imagePath: emptyToNull(data.imagePath),
          available: data.available,
          requiresPrep: data.requiresPrep,
          estimatedPrepMins: data.estimatedPrepMins ?? null,
          tags: data.tags,
          active: data.active,
        },
      });

      await syncModifierGroups(tx, created.id, data.modifierGroups);
      return created;
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MENU_ITEM_CREATE",
        entity: "MenuItem",
        entityId: item.id,
        after: {
          name: item.name,
          price: Number(item.price),
          categoryId: item.categoryId,
        },
      },
    });

    revalidateMenu();
    return { ok: true, message: "Producto creado.", id: item.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo crear el producto." };
  }
}

export async function updateMenuItemAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("menu", "update");
    const data = updateMenuItemSchema.parse(raw);

    const existing = await prisma.menuItem.findUnique({
      where: { id: data.id },
    });
    if (!existing) return { ok: false, error: "Producto no encontrado." };

    if (data.categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: {
          id: data.categoryId,
          locationId: data.locationId ?? existing.locationId,
        },
      });
      if (!category) return { ok: false, error: "Categoría inválida." };
    }

    if (data.sku !== undefined) {
      const sku = emptyToNull(data.sku);
      if (sku) {
        const clash = await prisma.menuItem.findFirst({
          where: {
            locationId: existing.locationId,
            sku,
            NOT: { id: existing.id },
          },
        });
        if (clash) {
          return { ok: false, error: "El SKU ya existe en esta sucursal." };
        }
      }
    }

    const priceChanged =
      data.price !== undefined &&
      Number(existing.price) !== Number(data.price);

    await prisma.$transaction(async (tx) => {
      await tx.menuItem.update({
        where: { id: data.id },
        data: {
          categoryId: data.categoryId,
          name: data.name?.trim(),
          description:
            data.description === undefined
              ? undefined
              : emptyToNull(data.description),
          sku: data.sku === undefined ? undefined : emptyToNull(data.sku),
          price: data.price,
          estimatedCost:
            data.estimatedCost === undefined ? undefined : data.estimatedCost,
          taxRate: data.taxRate,
          imageUrl:
            data.imageUrl === undefined
              ? undefined
              : emptyToNull(data.imageUrl),
          imagePath:
            data.imagePath === undefined
              ? undefined
              : emptyToNull(data.imagePath),
          available: data.available,
          requiresPrep: data.requiresPrep,
          estimatedPrepMins:
            data.estimatedPrepMins === undefined
              ? undefined
              : data.estimatedPrepMins,
          tags: data.tags,
          active: data.active,
        },
      });

      if (data.modifierGroups) {
        await syncModifierGroups(tx, data.id, data.modifierGroups);
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: priceChanged ? "MENU_ITEM_PRICE_CHANGE" : "MENU_ITEM_UPDATE",
        entity: "MenuItem",
        entityId: data.id,
        before: {
          name: existing.name,
          price: Number(existing.price),
          available: existing.available,
          active: existing.active,
        },
        after: {
          name: data.name ?? existing.name,
          price: data.price ?? Number(existing.price),
          available: data.available ?? existing.available,
          active: data.active ?? existing.active,
        },
      },
    });

    revalidateMenu();
    return { ok: true, message: "Producto actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo actualizar el producto." };
  }
}

export async function toggleMenuItemAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("menu", "update");
    const data = toggleMenuItemSchema.parse(raw);

    const existing = await prisma.menuItem.findUnique({
      where: { id: data.id },
    });
    if (!existing) return { ok: false, error: "Producto no encontrado." };

    const updated = await prisma.menuItem.update({
      where: { id: data.id },
      data: {
        available: data.available,
        active: data.active,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MENU_ITEM_TOGGLE",
        entity: "MenuItem",
        entityId: updated.id,
        before: {
          available: existing.available,
          active: existing.active,
        },
        after: {
          available: updated.available,
          active: updated.active,
        },
      },
    });

    revalidateMenu();
    return { ok: true, message: "Estado actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}
