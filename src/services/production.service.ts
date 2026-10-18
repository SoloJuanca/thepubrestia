import {
  MovementType,
  Prisma,
  ReferenceType,
  UnitType,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inventoryService } from "@/services/inventory.service";

type Tx = Prisma.TransactionClient | PrismaClient;

function toNum(v: Prisma.Decimal | number | string) {
  return Number(v);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type CreatePrepRecipeInput = {
  locationId: string;
  outputIngredientId: string;
  outputQuantity: number;
  notes?: string | null;
  items: Array<{
    ingredientId: string;
    quantity: number;
    unit: UnitType;
  }>;
};

export type RunProductionBatchInput = {
  locationId: string;
  outputIngredientId: string;
  /** Real produced quantity in output base unit */
  quantityProduced: number;
  /** Scale factor vs recipe outputQuantity (default 1 = one recipe batch) */
  batchMultiplier?: number;
  employeeId?: string | null;
  notes?: string | null;
};

export class ProductionService {
  async upsertPrepRecipe(input: CreatePrepRecipeInput) {
    if (input.outputQuantity <= 0) {
      throw new Error("La cantidad de salida debe ser mayor a 0.");
    }
    if (!input.items.length) {
      throw new Error("Agrega al menos un insumo de entrada.");
    }

    const output = await prisma.ingredient.findFirst({
      where: { id: input.outputIngredientId, locationId: input.locationId },
    });
    if (!output) throw new Error("Insumo de salida no encontrado.");
    if (output.kind !== "PREP") {
      throw new Error("Solo se pueden producir insumos tipo PREP.");
    }

    return prisma.$transaction(async (tx) => {
      const recipe = await tx.prepRecipe.upsert({
        where: { outputIngredientId: input.outputIngredientId },
        create: {
          locationId: input.locationId,
          outputIngredientId: input.outputIngredientId,
          outputQuantity: input.outputQuantity,
          notes: input.notes ?? null,
          active: true,
        },
        update: {
          outputQuantity: input.outputQuantity,
          notes: input.notes ?? null,
          active: true,
        },
      });

      await tx.prepRecipeItem.deleteMany({ where: { prepRecipeId: recipe.id } });
      await tx.prepRecipeItem.createMany({
        data: input.items.map((item) => ({
          prepRecipeId: recipe.id,
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
        })),
      });

      return tx.prepRecipe.findUniqueOrThrow({
        where: { id: recipe.id },
        include: {
          items: { include: { ingredient: true } },
          outputIngredient: true,
        },
      });
    });
  }

  async runBatch(input: RunProductionBatchInput, client: Tx = prisma) {
    if (input.quantityProduced <= 0) {
      throw new Error("La cantidad producida debe ser mayor a 0.");
    }

    const multiplier = input.batchMultiplier ?? 1;
    if (multiplier <= 0) throw new Error("El multiplicador debe ser > 0.");

    const run = async (tx: Prisma.TransactionClient) => {
      const recipe = await tx.prepRecipe.findUnique({
        where: { outputIngredientId: input.outputIngredientId },
        include: { items: true, outputIngredient: true },
      });
      if (!recipe || !recipe.active) {
        throw new Error("No hay receta de producción activa para este prep.");
      }
      if (recipe.locationId !== input.locationId) {
        throw new Error("La receta no pertenece a esta sucursal.");
      }
      if (recipe.items.length === 0) {
        throw new Error(
          "La receta PREP no tiene insumos. Configúrala antes de producir.",
        );
      }

      const theoretical = toNum(recipe.outputQuantity) * multiplier;
      const yieldPercent =
        theoretical > 0
          ? round2((input.quantityProduced / theoretical) * 100)
          : 0;

      // Consume inputs
      for (const item of recipe.items) {
        const qty = toNum(item.quantity) * multiplier;
        if (qty <= 0) continue;
        await inventoryService.applyStockChange(
          {
            ingredientId: item.ingredientId,
            quantityDelta: -qty,
            movementType: MovementType.PRODUCTION_OUT,
            referenceType: ReferenceType.PRODUCTION,
            employeeId: input.employeeId ?? null,
            notes: `Producción → ${recipe.outputIngredient.name}`,
          },
          tx,
        );
      }

      // Add output
      await inventoryService.applyStockChange(
        {
          ingredientId: input.outputIngredientId,
          quantityDelta: input.quantityProduced,
          movementType: MovementType.PRODUCTION_IN,
          referenceType: ReferenceType.PRODUCTION,
          employeeId: input.employeeId ?? null,
          notes: `Batch producción (${yieldPercent}% rendimiento)`,
        },
        tx,
      );

      const batch = await tx.productionBatch.create({
        data: {
          locationId: input.locationId,
          outputIngredientId: input.outputIngredientId,
          quantityTheoretical: theoretical,
          quantityProduced: input.quantityProduced,
          yieldPercent,
          employeeId: input.employeeId ?? null,
          notes: input.notes ?? null,
          inputs: {
            create: recipe.items.map((item) => ({
              ingredientId: item.ingredientId,
              quantity: toNum(item.quantity) * multiplier,
              unit: item.unit,
            })),
          },
        },
        include: {
          outputIngredient: true,
          inputs: { include: { ingredient: true } },
          employee: true,
        },
      });

      return batch;
    };

    if (client === prisma) {
      return prisma.$transaction(run);
    }
    return run(client as Prisma.TransactionClient);
  }

  async listBatches(locationId: string, take = 50) {
    return prisma.productionBatch.findMany({
      where: { locationId },
      include: {
        outputIngredient: true,
        employee: true,
        inputs: { include: { ingredient: true } },
      },
      orderBy: { producedAt: "desc" },
      take,
    });
  }

  async listPrepRecipes(locationId: string) {
    return prisma.prepRecipe.findMany({
      where: { locationId, active: true },
      include: {
        outputIngredient: true,
        items: { include: { ingredient: true } },
      },
      orderBy: { outputIngredient: { name: "asc" } },
    });
  }

  /**
   * Theoretical consumption from closed order items in range
   * vs actual SALE_CONSUMPTION movements.
   */
  async yieldReport(params: {
    locationId: string;
    from: Date;
    to: Date;
  }) {
    const items = await prisma.orderItem.findMany({
      where: {
        check: {
          status: "CLOSED",
          closedAt: { gte: params.from, lte: params.to },
          order: { locationId: params.locationId },
        },
        status: { not: "CANCELLED" },
        menuItemId: { not: null },
      },
      include: {
        menuItem: {
          include: { recipeItems: { include: { ingredient: true } } },
        },
      },
    });

    type Acc = {
      menuItemId: string;
      name: string;
      soldQty: number;
      theoreticalByIngredient: Map<string, { name: string; qty: number; unit: string }>;
    };

    const byMenu = new Map<string, Acc>();
    for (const item of items) {
      if (!item.menuItem) continue;
      const key = item.menuItem.id;
      let acc = byMenu.get(key);
      if (!acc) {
        acc = {
          menuItemId: key,
          name: item.menuItem.name,
          soldQty: 0,
          theoreticalByIngredient: new Map(),
        };
        byMenu.set(key, acc);
      }
      acc.soldQty += item.quantity;
      for (const r of item.menuItem.recipeItems) {
        const prev = acc.theoreticalByIngredient.get(r.ingredientId) ?? {
          name: r.ingredient.name,
          qty: 0,
          unit: r.unit,
        };
        prev.qty += toNum(r.quantity) * item.quantity;
        acc.theoreticalByIngredient.set(r.ingredientId, prev);
      }
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        locationId: params.locationId,
        movementType: "SALE_CONSUMPTION",
        createdAt: { gte: params.from, lte: params.to },
      },
      include: { ingredient: true },
    });

    const actualByIngredient = new Map<string, number>();
    for (const m of movements) {
      const prev = actualByIngredient.get(m.ingredientId) ?? 0;
      actualByIngredient.set(m.ingredientId, prev + Math.abs(toNum(m.quantity)));
    }

    return Array.from(byMenu.values()).map((row) => ({
      menuItemId: row.menuItemId,
      name: row.name,
      soldQty: row.soldQty,
      lines: Array.from(row.theoreticalByIngredient.entries()).map(
        ([ingredientId, t]) => {
          const actual = actualByIngredient.get(ingredientId) ?? 0;
          const variancePct =
            t.qty > 0 ? round2(((actual - t.qty) / t.qty) * 100) : 0;
          return {
            ingredientId,
            ingredientName: t.name,
            unit: t.unit,
            theoretical: round2(t.qty),
            actual: round2(actual),
            variancePct,
          };
        },
      ),
    }));
  }
}

export const productionService = new ProductionService();
