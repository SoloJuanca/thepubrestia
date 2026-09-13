import {
  MovementType,
  Prisma,
  ReferenceType,
  UnitType,
  WasteReason,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | PrismaClient;

export type StockChangeInput = {
  ingredientId: string;
  /** Signed delta in ingredient base unit. Positive = increase. */
  quantityDelta: number;
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId?: string | null;
  unitCost?: number | null;
  notes?: string | null;
  employeeId?: string | null;
};

export type WasteInput = {
  ingredientId: string;
  quantity: number;
  reason: WasteReason;
  comment?: string | null;
  employeeId: string;
};

export type AlertIngredient = {
  id: string;
  name: string;
  baseUnit: UnitType;
  currentStock: number;
  minimumStock: number;
  targetStock: number | null;
  suggestedPurchase: number;
  preferredSupplierName: string | null;
  status: "OUT" | "LOW";
};

function toNumber(value: Prisma.Decimal | number | string) {
  return Number(value);
}

function roundQty(n: number) {
  return Math.round(n * 10000) / 10000;
}

export class InventoryService {
  /**
   * Applies a stock delta and always writes an InventoryMovement.
   * Uses SELECT … FOR UPDATE inside a transaction.
   */
  async applyStockChange(
    input: StockChangeInput,
    client: Tx = prisma,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          locationId: string;
          currentStock: Prisma.Decimal;
          averageCost: Prisma.Decimal;
          active: boolean;
        }>
      >`
        SELECT id, "locationId", "currentStock", "averageCost", active
        FROM "Ingredient"
        WHERE id = ${input.ingredientId}
        FOR UPDATE
      `;

      const ingredient = locked[0];
      if (!ingredient) {
        throw new Error("Ingrediente no encontrado.");
      }
      if (!ingredient.active) {
        throw new Error("El ingrediente está inactivo.");
      }

      const previousStock = toNumber(ingredient.currentStock);
      const delta = roundQty(input.quantityDelta);
      if (delta === 0) {
        throw new Error("La cantidad del movimiento no puede ser 0.");
      }

      const resultingStock = roundQty(previousStock + delta);
      if (resultingStock < 0) {
        throw new Error(
          `Stock insuficiente. Actual: ${previousStock}, solicitado: ${Math.abs(delta)}.`,
        );
      }

      let nextAverageCost = toNumber(ingredient.averageCost);
      if (
        delta > 0 &&
        input.unitCost != null &&
        Number.isFinite(input.unitCost) &&
        resultingStock > 0
      ) {
        const incomingCost = input.unitCost * delta;
        const existingValue = previousStock * nextAverageCost;
        nextAverageCost = roundQty(
          (existingValue + incomingCost) / resultingStock,
        );
      }

      await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          currentStock: resultingStock,
          averageCost: nextAverageCost,
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          locationId: ingredient.locationId,
          ingredientId: ingredient.id,
          quantity: delta,
          movementType: input.movementType,
          referenceType: input.referenceType,
          referenceId: input.referenceId ?? null,
          previousStock,
          resultingStock,
          unitCost: input.unitCost ?? null,
          notes: input.notes ?? null,
          employeeId: input.employeeId ?? null,
        },
      });

      return { movement, previousStock, resultingStock };
    };

    if ("$transaction" in client && typeof client.$transaction === "function") {
      return client.$transaction(run);
    }
    return run(client as Prisma.TransactionClient);
  }

  async recordWaste(input: WasteInput) {
    if (input.quantity <= 0) {
      throw new Error("La merma debe ser mayor a 0.");
    }

    return prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUnique({
        where: { id: input.ingredientId },
      });
      if (!ingredient) throw new Error("Ingrediente no encontrado.");

      const { movement } = await this.applyStockChange(
        {
          ingredientId: input.ingredientId,
          quantityDelta: -Math.abs(input.quantity),
          movementType: "WASTE",
          referenceType: "WASTE",
          notes: input.comment ?? `Merma: ${input.reason}`,
          employeeId: input.employeeId,
          unitCost: toNumber(ingredient.averageCost),
        },
        tx,
      );

      const waste = await tx.wasteRecord.create({
        data: {
          locationId: ingredient.locationId,
          ingredientId: ingredient.id,
          quantity: input.quantity,
          unit: ingredient.baseUnit,
          reason: input.reason,
          comment: input.comment ?? null,
          employeeId: input.employeeId,
          movementId: movement.id,
        },
      });

      return { waste, movement };
    });
  }

  async setStockAbsolute(params: {
    ingredientId: string;
    newStock: number;
    employeeId?: string | null;
    notes?: string | null;
  }) {
    if (params.newStock < 0) {
      throw new Error("El stock no puede ser negativo.");
    }

    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; currentStock: Prisma.Decimal }>
      >`
        SELECT id, "currentStock"
        FROM "Ingredient"
        WHERE id = ${params.ingredientId}
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row) throw new Error("Ingrediente no encontrado.");

      const previous = toNumber(row.currentStock);
      const delta = roundQty(params.newStock - previous);
      if (delta === 0) {
        throw new Error("El stock ya tiene ese valor.");
      }

      return this.applyStockChange(
        {
          ingredientId: params.ingredientId,
          quantityDelta: delta,
          movementType: "ADJUSTMENT",
          referenceType: "ADJUSTMENT",
          employeeId: params.employeeId,
          notes: params.notes ?? `Ajuste a ${params.newStock}`,
        },
        tx,
      );
    });
  }

  suggestedPurchase(current: number, minimum: number, target: number | null) {
    const goal = target != null && target > 0 ? target : minimum;
    return Math.max(0, roundQty(goal - current));
  }

  async getStockAlerts(locationId: string): Promise<{
    low: AlertIngredient[];
    out: AlertIngredient[];
    suggested: AlertIngredient[];
  }> {
    const ingredients = await prisma.ingredient.findMany({
      where: { locationId, active: true },
      include: { preferredSupplier: true },
      orderBy: { name: "asc" },
    });

    const mapped: AlertIngredient[] = ingredients.map((ing) => {
      const currentStock = toNumber(ing.currentStock);
      const minimumStock = toNumber(ing.minimumStock);
      const targetStock =
        ing.targetStock != null ? toNumber(ing.targetStock) : null;
      const suggestedPurchase = this.suggestedPurchase(
        currentStock,
        minimumStock,
        targetStock,
      );
      const status: "OUT" | "LOW" =
        currentStock <= 0 ? "OUT" : "LOW";
      return {
        id: ing.id,
        name: ing.name,
        baseUnit: ing.baseUnit,
        currentStock,
        minimumStock,
        targetStock,
        suggestedPurchase,
        preferredSupplierName: ing.preferredSupplier?.name ?? null,
        status,
      };
    });

    const out = mapped.filter((i) => i.currentStock <= 0);
    const low = mapped.filter(
      (i) => i.currentStock > 0 && i.currentStock < i.minimumStock,
    );
    const suggested = mapped.filter((i) => i.suggestedPurchase > 0);

    return { low, out, suggested };
  }
}

export const inventoryService = new InventoryService();
