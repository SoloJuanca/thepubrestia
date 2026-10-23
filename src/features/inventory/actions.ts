"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { inventoryService } from "@/services/inventory.service";
import { productionService } from "@/services/production.service";
import { isPrepared, looksPerishable } from "@/features/inventory/stock-rules";
import {
  adjustStockSchema,
  bulkUpdateIngredientsSchema,
  createIngredientSchema,
  deleteIngredientsSchema,
  markLotTodaySchema,
  runProductionBatchSchema,
  savePrepRecipeSchema,
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
          kind: data.kind,
          baseUnit: data.baseUnit,
          packSize: data.packSize ?? null,
          storageNote: emptyToNull(data.storageNote),
          currentStock: 0,
          minimumStock: data.minimumStock,
          targetStock: data.targetStock ?? null,
          averageCost: data.averageCost,
          preferredSupplierId: emptyToNull(data.preferredSupplierId),
          perishable: isPrepared(data.kind)
            ? false
            : (data.perishable ??
              looksPerishable(data.name, data.category)),
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
        kind: data.kind,
        baseUnit: data.baseUnit,
        packSize:
          data.packSize === undefined ? undefined : data.packSize,
        storageNote:
          data.storageNote === undefined
            ? undefined
            : emptyToNull(data.storageNote),
        minimumStock: data.minimumStock,
        targetStock:
          data.targetStock === undefined ? undefined : data.targetStock,
        averageCost: data.averageCost,
        preferredSupplierId:
          data.preferredSupplierId === undefined
            ? undefined
            : emptyToNull(data.preferredSupplierId),
        perishable:
          data.perishable === undefined
            ? undefined
            : isPrepared(data.kind ?? existing.kind)
              ? false
              : data.perishable,
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

export async function bulkUpdateIngredientsAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const data = bulkUpdateIngredientsSchema.parse(raw);
    const needsMeta =
      data.applySupplier ||
      data.applyKind ||
      data.applyCategory ||
      data.applyMinimum ||
      data.applyTarget ||
      data.applyActive;
    const needsStock = data.applyStock;

    if (!needsMeta && !needsStock) {
      return { ok: false, error: "Marca al menos un campo a modificar." };
    }

    let userId: string | null = null;
    if (needsMeta) {
      const { user } = await assertPermission("inventory", "update");
      userId = user.id;
    }
    if (needsStock) {
      const { user } = await assertPermission("inventory", "adjust");
      userId = user.id;
    }

    const found = await prisma.ingredient.findMany({
      where: { id: { in: data.ids } },
      select: { id: true },
    });
    if (found.length !== data.ids.length) {
      return { ok: false, error: "Uno o más ingredientes no existen." };
    }

    if (needsMeta) {
      const patch: {
        preferredSupplierId?: string | null;
        kind?: "RAW" | "PREP" | "FROZEN" | "PACKAGED";
        category?: string | null;
        minimumStock?: number;
        targetStock?: number | null;
        active?: boolean;
      } = {};
      if (data.applySupplier) {
        patch.preferredSupplierId = emptyToNull(data.preferredSupplierId);
      }
      if (data.applyKind && data.kind) patch.kind = data.kind;
      if (data.applyCategory) {
        patch.category = emptyToNull(data.category);
      }
      if (data.applyMinimum && data.minimumStock !== undefined) {
        patch.minimumStock = data.minimumStock;
      }
      if (data.applyTarget) {
        patch.targetStock =
          data.targetStock === undefined || data.targetStock === null
            ? null
            : data.targetStock;
      }
      if (data.applyActive && data.active !== undefined) {
        patch.active = data.active;
      }

      await prisma.ingredient.updateMany({
        where: { id: { in: data.ids } },
        data: patch,
      });
    }

    if (needsStock) {
      if (data.stockQuantity === undefined) {
        return { ok: false, error: "Indica la cantidad de stock." };
      }
      const mode = data.stockMode ?? "delta";
      if (mode === "delta" && data.stockQuantity === 0) {
        return { ok: false, error: "La cantidad delta no puede ser 0." };
      }
      for (const id of data.ids) {
        try {
          if (mode === "absolute") {
            await inventoryService.setStockAbsolute({
              ingredientId: id,
              newStock: data.stockQuantity,
              employeeId: userId,
              notes: data.stockNotes ?? "Ajuste masivo",
            });
          } else {
            await inventoryService.applyStockChange({
              ingredientId: id,
              quantityDelta: data.stockQuantity,
              movementType: "ADJUSTMENT",
              referenceType: "ADJUSTMENT",
              employeeId: userId,
              notes: data.stockNotes ?? "Ajuste masivo",
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          // Skip no-op absolute sets so the rest of the batch continues.
          if (msg.includes("ya tiene ese valor")) continue;
          throw err;
        }
      }
    }

    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "INGREDIENT_BULK_UPDATE",
          entity: "Ingredient",
          entityId: data.ids[0],
          after: {
            count: data.ids.length,
            ids: data.ids,
            apply: {
              supplier: data.applySupplier,
              kind: data.applyKind,
              category: data.applyCategory,
              minimum: data.applyMinimum,
              target: data.applyTarget,
              active: data.applyActive,
              stock: data.applyStock,
            },
          },
        },
      });
    }

    revalidateInventory();
    return {
      ok: true,
      message: `Actualizados ${data.ids.length} ingredientes.`,
    };
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
          : "No se pudo actualizar en lote.",
    };
  }
}

async function removeIngredientRecord(
  id: string,
  userId: string,
): Promise<"hard" | "soft"> {
  const [
    movements,
    waste,
    purchases,
    recipeItems,
    prepInputs,
    productionOut,
    productionIn,
    supplierProducts,
  ] = await Promise.all([
    prisma.inventoryMovement.count({ where: { ingredientId: id } }),
    prisma.wasteRecord.count({ where: { ingredientId: id } }),
    prisma.purchaseOrderItem.count({ where: { ingredientId: id } }),
    prisma.recipeItem.count({ where: { ingredientId: id } }),
    prisma.prepRecipeItem.count({ where: { ingredientId: id } }),
    prisma.productionBatch.count({ where: { outputIngredientId: id } }),
    prisma.productionBatchInput.count({ where: { ingredientId: id } }),
    prisma.supplierProduct.count({ where: { ingredientId: id } }),
  ]);

  const hasHistory =
    movements +
      waste +
      purchases +
      recipeItems +
      prepInputs +
      productionOut +
      productionIn >
    0;

  if (hasHistory) {
    await prisma.ingredient.update({
      where: { id },
      data: { active: false },
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "INGREDIENT_SOFT_DELETE",
        entity: "Ingredient",
        entityId: id,
        after: { active: false },
      },
    });
    return "soft";
  }

  await prisma.$transaction(async (tx) => {
    if (supplierProducts > 0) {
      await tx.supplierProduct.deleteMany({ where: { ingredientId: id } });
    }
    // PrepRecipe as output cascades when ingredient is deleted.
    await tx.ingredient.delete({ where: { id } });
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "INGREDIENT_DELETE",
      entity: "Ingredient",
      entityId: id,
    },
  });
  return "hard";
}

export async function deleteIngredientsAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("inventory", "create");
    const data = deleteIngredientsSchema.parse(raw);

    const found = await prisma.ingredient.findMany({
      where: { id: { in: data.ids } },
      select: { id: true, name: true, active: true },
    });
    if (found.length === 0) {
      return { ok: false, error: "No se encontraron ingredientes." };
    }

    let soft = 0;
    let hard = 0;
    for (const row of found) {
      const mode = await removeIngredientRecord(row.id, user.id);
      if (mode === "soft") soft += 1;
      else hard += 1;
    }

    revalidateInventory();
    const parts: string[] = [];
    if (hard > 0) parts.push(`${hard} eliminados`);
    if (soft > 0) {
      parts.push(
        `${soft} desactivados (tienen historial o recetas)`,
      );
    }
    return {
      ok: true,
      message: parts.length
        ? parts.join(" · ")
        : "Sin cambios.",
    };
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
          : "No se pudo eliminar.",
    };
  }
}

export async function markLotTodayAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("inventory", "adjust");
    const data = markLotTodaySchema.parse(raw);
    await inventoryService.markLotToday(data.ingredientId);
    revalidateInventory();
    return { ok: true, message: "Fecha actualizada a hoy." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo actualizar la fecha.",
    };
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
    const { user } = await assertPermission("recipes", "update");
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

    const costById = new Map(
      ingredients.map((i) => [i.id, Number(i.averageCost)]),
    );
    const estimatedCost = data.items.reduce(
      (sum, item) => sum + item.quantity * (costById.get(item.ingredientId) ?? 0),
      0,
    );

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
      await tx.menuItem.update({
        where: { id: data.menuItemId },
        data: { estimatedCost },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "RECIPE_UPDATE",
        entity: "MenuItem",
        entityId: data.menuItemId,
        after: { items: data.items, estimatedCost },
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

export async function runProductionBatchAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("inventory", "adjust");
    const data = runProductionBatchSchema.parse(raw);
    const batch = await productionService.runBatch({
      locationId: data.locationId,
      outputIngredientId: data.outputIngredientId,
      quantityProduced: data.quantityProduced,
      batchMultiplier: data.batchMultiplier,
      notes: data.notes,
      employeeId: user.id,
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PRODUCTION_BATCH",
        entity: "ProductionBatch",
        entityId: batch.id,
        after: {
          output: batch.outputIngredientId,
          produced: Number(batch.quantityProduced),
          yield: Number(batch.yieldPercent),
        },
      },
    });
    revalidateInventory();
    return {
      ok: true,
      message: `Producción registrada · rendimiento ${Number(batch.yieldPercent)}%`,
      id: batch.id,
    };
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
          : "No se pudo registrar la producción.",
    };
  }
}

export async function savePrepRecipeAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("recipes", "update");
    const data = savePrepRecipeSchema.parse(raw);
    const recipe = await productionService.upsertPrepRecipe(data);
    revalidateInventory();
    return {
      ok: true,
      message: "Receta de producción guardada.",
      id: recipe.id,
    };
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
          : "No se pudo guardar la receta de producción.",
    };
  }
}
