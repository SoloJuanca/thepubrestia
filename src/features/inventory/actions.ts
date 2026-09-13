"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { inventoryService } from "@/services/inventory.service";
import {
  adjustStockSchema,
  createIngredientSchema,
  saveRecipeSchema,
  updateIngredientSchema,
  wasteSchema,
} from "@/validations/inventory";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/menu");
  revalidatePath("/dashboard");
}

function emptyToNull(value?: string | null) {
  if (value == null || value === "") return null;
  return value;
}

export async function createIngredientAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("inventory", "create");
    const data = createIngredientSchema.parse(raw);

    const ingredient = await prisma.$transaction(async (tx) => {
      const created = await tx.ingredient.create({
        data: {
          locationId: data.locationId,
          name: data.name.trim(),
          category: emptyToNull(data.category),
          baseUnit: data.baseUnit,
          currentStock: 0,
          minimumStock: data.minimumStock,
          targetStock: data.targetStock ?? null,
          averageCost: data.averageCost,
          preferredSupplierId: emptyToNull(data.preferredSupplierId),
          active: data.active,
        },
      });

      if (data.currentStock > 0) {
        await inventoryService.applyStockChange(
          {
            ingredientId: created.id,
            quantityDelta: data.currentStock,
            movementType: "ADJUSTMENT",
            referenceType: "MANUAL",
            unitCost: data.averageCost,
            notes: "Stock inicial",
            employeeId: user.id,
          },
          tx,
        );
      }

      return created;
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "INGREDIENT_CREATE",
        entity: "Ingredient",
        entityId: ingredient.id,
        after: { name: ingredient.name, unit: ingredient.baseUnit },
      },
    });

    revalidateInventory();
    return { ok: true, message: "Ingrediente creado.", id: ingredient.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear el ingrediente.",
    };
  }
}

export async function updateIngredientAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("inventory", "update");
    const data = updateIngredientSchema.parse(raw);

    const existing = await prisma.ingredient.findUnique({
      where: { id: data.id },
    });
    if (!existing) return { ok: false, error: "Ingrediente no encontrado." };

    const updated = await prisma.ingredient.update({
      where: { id: data.id },
      data: {
        name: data.name?.trim(),
        category:
          data.category === undefined
            ? undefined
            : emptyToNull(data.category),
        baseUnit: data.baseUnit,
        minimumStock: data.minimumStock,
        targetStock:
          data.targetStock === undefined ? undefined : data.targetStock,
        averageCost: data.averageCost,
        preferredSupplierId:
          data.preferredSupplierId === undefined
            ? undefined
            : emptyToNull(data.preferredSupplierId),
        active: data.active,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "INGREDIENT_UPDATE",
        entity: "Ingredient",
        entityId: updated.id,
        before: {
          name: existing.name,
          minimumStock: Number(existing.minimumStock),
          active: existing.active,
        },
        after: {
          name: updated.name,
          minimumStock: Number(updated.minimumStock),
          active: updated.active,
        },
      },
    });

    revalidateInventory();
    return { ok: true, message: "Ingrediente actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo actualizar el ingrediente." };
  }
}

export async function adjustStockAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("inventory", "adjust");
    const data = adjustStockSchema.parse(raw);

    if (data.mode === "absolute") {
      await inventoryService.setStockAbsolute({
        ingredientId: data.ingredientId,
        newStock: data.quantity,
        employeeId: user.id,
        notes: data.notes,
      });
    } else {
      if (data.quantity === 0) {
        return { ok: false, error: "La cantidad no puede ser 0." };
      }
      await inventoryService.applyStockChange({
        ingredientId: data.ingredientId,
        quantityDelta: data.quantity,
        movementType: "ADJUSTMENT",
        referenceType: "ADJUSTMENT",
        employeeId: user.id,
        notes: data.notes,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "INVENTORY_ADJUSTMENT",
        entity: "Ingredient",
        entityId: data.ingredientId,
        after: data,
      },
    });

    revalidateInventory();
    return { ok: true, message: "Stock ajustado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo ajustar el stock.",
    };
  }
}

export async function recordWasteAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("inventory", "adjust");
    const data = wasteSchema.parse(raw);

    await inventoryService.recordWaste({
      ingredientId: data.ingredientId,
      quantity: data.quantity,
      reason: data.reason,
      comment: data.comment,
      employeeId: user.id,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "INVENTORY_WASTE",
        entity: "Ingredient",
        entityId: data.ingredientId,
        after: data,
      },
    });

    revalidateInventory();
    return { ok: true, message: "Merma registrada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo registrar la merma.",
    };
  }
}

export async function saveRecipeAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("inventory", "update");
    const data = saveRecipeSchema.parse(raw);

    const menuItem = await prisma.menuItem.findUnique({
      where: { id: data.menuItemId },
    });
    if (!menuItem) return { ok: false, error: "Producto no encontrado." };

    const ingredientIds = data.items.map((i) => i.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      return { ok: false, error: "Hay ingredientes duplicados en la receta." };
    }

    const ingredients = await prisma.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        locationId: menuItem.locationId,
        active: true,
      },
    });
    if (ingredients.length !== ingredientIds.length) {
      return {
        ok: false,
        error: "Uno o más ingredientes no pertenecen a la sucursal.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { menuItemId: data.menuItemId } });
      if (data.items.length > 0) {
        await tx.recipeItem.createMany({
          data: data.items.map((item) => ({
            menuItemId: data.menuItemId,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        });
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "RECIPE_UPDATE",
        entity: "MenuItem",
        entityId: data.menuItemId,
        after: { items: data.items },
      },
    });

    revalidateInventory();
    return { ok: true, message: "Receta guardada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo guardar la receta." };
  }
}
