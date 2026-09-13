import { PurchaseOrderStatus, type UnitType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inventoryService } from "@/services/inventory.service";

function toNum(v: { toString(): string } | number | string) {
  return Number(v);
}

function roundQty(n: number) {
  return Math.round(n * 10000) / 10000;
}

function roundCost(n: number) {
  return Math.round(n * 10000) / 10000;
}

const WEEKDAY_FROM_JS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export function weekdayToday(date = new Date()) {
  return WEEKDAY_FROM_JS[date.getDay()]!;
}

/** Pure guards for receive flow + tests */
export function assertReceiveQty(params: {
  ordered: number;
  alreadyReceived: number;
  incoming: number;
  ingredientName?: string;
}) {
  const remaining = roundQty(params.ordered - params.alreadyReceived);
  if (params.incoming > remaining + 0.0001) {
    throw new Error(
      `Cantidad excesiva${params.ingredientName ? ` para ${params.ingredientName}` : ""}. Restante: ${remaining}.`,
    );
  }
}

export function stockAfterReceive(current: number, qty: number) {
  return roundQty(current + qty);
}

export type PoLineInput = {
  ingredientId: string;
  quantityOrdered: number;
  unit: UnitType;
  expectedUnitCost: number;
};

export type ReceiveLineInput = {
  itemId: string;
  quantityReceived: number;
  actualUnitCost?: number | null;
};

export class PurchaseOrderService {
  async createDraft(params: {
    locationId: string;
    supplierId: string;
    notes?: string | null;
    createdById?: string | null;
    items?: PoLineInput[];
  }) {
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: params.supplierId,
        locationId: params.locationId,
        active: true,
      },
    });
    if (!supplier) throw new Error("Proveedor no encontrado.");

    return prisma.purchaseOrder.create({
      data: {
        locationId: params.locationId,
        supplierId: params.supplierId,
        status: "DRAFT",
        notes: params.notes ?? null,
        createdById: params.createdById ?? null,
        items: params.items?.length
          ? {
              create: params.items.map((item) => ({
                ingredientId: item.ingredientId,
                quantityOrdered: roundQty(item.quantityOrdered),
                unit: item.unit,
                expectedUnitCost: roundCost(item.expectedUnitCost),
              })),
            }
          : undefined,
      },
      include: { items: true, supplier: true },
    });
  }

  async replaceDraftItems(poId: string, items: PoLineInput[]) {
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({ where: { id: poId } });
      if (!po) throw new Error("Orden de compra no encontrada.");
      if (po.status !== "DRAFT") {
        throw new Error("Solo se pueden editar ítems en borrador.");
      }
      if (!items.length) throw new Error("Agrega al menos un ítem.");

      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: poId },
      });
      await tx.purchaseOrderItem.createMany({
        data: items.map((item) => ({
          purchaseOrderId: poId,
          ingredientId: item.ingredientId,
          quantityOrdered: roundQty(item.quantityOrdered),
          unit: item.unit,
          expectedUnitCost: roundCost(item.expectedUnitCost),
        })),
      });

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
        include: { items: true, supplier: true },
      });
    });
  }

  async setStatus(params: {
    poId: string;
    status: Extract<PurchaseOrderStatus, "PENDING" | "ORDERED" | "CANCELLED">;
  }) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.poId },
      include: { items: true },
    });
    if (!po) throw new Error("Orden de compra no encontrada.");

    if (params.status === "CANCELLED") {
      if (["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].includes(po.status)) {
        throw new Error("No se puede cancelar esta orden.");
      }
      return prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { status: "CANCELLED" },
      });
    }

    if (params.status === "PENDING") {
      if (po.status !== "DRAFT") {
        throw new Error("Solo un borrador puede enviarse a pendiente.");
      }
      if (!po.items.length) throw new Error("La orden no tiene ítems.");
      return prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { status: "PENDING" },
      });
    }

    if (!["DRAFT", "PENDING"].includes(po.status)) {
      throw new Error("No se puede marcar como pedida en este estado.");
    }
    if (!po.items.length) throw new Error("La orden no tiene ítems.");
    return prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: "ORDERED",
        orderedAt: po.orderedAt ?? new Date(),
      },
    });
  }

  /**
   * Partial or full receive. Updates stock + weighted average cost via PURCHASE movements.
   */
  async receive(params: {
    poId: string;
    lines: ReceiveLineInput[];
    employeeId: string;
  }) {
    if (!params.lines.length) throw new Error("Indica cantidades a recibir.");

    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          locationId: string;
          orderedAt: Date | null;
        }>
      >`
        SELECT id, status, "locationId", "orderedAt"
        FROM "PurchaseOrder"
        WHERE id = ${params.poId}
        FOR UPDATE
      `;
      const poRow = locked[0];
      if (!poRow) throw new Error("Orden de compra no encontrada.");
      if (
        !["ORDERED", "PARTIALLY_RECEIVED", "PENDING"].includes(poRow.status)
      ) {
        throw new Error(
          "Solo se pueden recibir órdenes pedidas o parcialmente recibidas.",
        );
      }

      const items = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: params.poId },
        include: { ingredient: true },
      });
      const byId = new Map(items.map((i) => [i.id, i]));

      let receivedSomething = false;
      for (const line of params.lines) {
        const qty = roundQty(line.quantityReceived);
        if (qty <= 0) continue;
        receivedSomething = true;

        const item = byId.get(line.itemId);
        if (!item) throw new Error("Ítem de orden no encontrado.");

        const already = toNum(item.quantityReceived);
        const ordered = toNum(item.quantityOrdered);
        assertReceiveQty({
          ordered,
          alreadyReceived: already,
          incoming: qty,
          ingredientName: item.ingredient.name,
        });

        const unitCost = roundCost(
          line.actualUnitCost != null && Number.isFinite(line.actualUnitCost)
            ? Number(line.actualUnitCost)
            : toNum(item.expectedUnitCost),
        );

        await inventoryService.applyStockChange(
          {
            ingredientId: item.ingredientId,
            quantityDelta: qty,
            movementType: "PURCHASE",
            referenceType: "PURCHASE_ORDER",
            referenceId: params.poId,
            unitCost,
            notes: `Recepción PO ${params.poId.slice(0, 8)} · ${item.ingredient.name}`,
            employeeId: params.employeeId,
          },
          tx,
        );

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: roundQty(already + qty),
            actualUnitCost: unitCost,
          },
        });
      }

      if (!receivedSomething) {
        throw new Error("Indica al menos una cantidad mayor a 0.");
      }

      const refreshed = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: params.poId },
      });

      const allReceived = refreshed.every(
        (i) => toNum(i.quantityReceived) + 0.0001 >= toNum(i.quantityOrdered),
      );
      const anyReceived = refreshed.some((i) => toNum(i.quantityReceived) > 0);

      let status: PurchaseOrderStatus = poRow.status as PurchaseOrderStatus;
      if (allReceived) status = "RECEIVED";
      else if (anyReceived) status = "PARTIALLY_RECEIVED";
      else if (poRow.status === "PENDING") status = "ORDERED";

      return tx.purchaseOrder.update({
        where: { id: params.poId },
        data: {
          status,
          orderedAt: poRow.orderedAt ?? new Date(),
          receivedAt: allReceived ? new Date() : undefined,
        },
        include: {
          items: { include: { ingredient: true } },
          supplier: true,
        },
      });
    });
  }

  async createSuggestedDrafts(params: {
    locationId: string;
    createdById: string;
  }) {
    const alerts = await inventoryService.getStockAlerts(params.locationId);
    const candidates = [...alerts.out, ...alerts.low].filter(
      (a) => a.suggestedPurchase > 0,
    );
    if (!candidates.length) {
      return { created: [] as string[], message: "Sin sugerencias de stock." };
    }

    const ingredients = await prisma.ingredient.findMany({
      where: {
        id: { in: candidates.map((c) => c.id) },
        locationId: params.locationId,
      },
      include: {
        preferredSupplier: {
          include: { products: true },
        },
      },
    });

    type Line = {
      ingredientId: string;
      quantityOrdered: number;
      unit: UnitType;
      expectedUnitCost: number;
    };
    const groups = new Map<string, Line[]>();

    for (const ing of ingredients) {
      if (!ing.preferredSupplierId || !ing.preferredSupplier?.active) continue;
      const alert = candidates.find((c) => c.id === ing.id);
      if (!alert) continue;

      const catalog = ing.preferredSupplier.products.find(
        (p) => p.ingredientId === ing.id && p.active,
      );

      const list = groups.get(ing.preferredSupplierId) ?? [];
      list.push({
        ingredientId: ing.id,
        quantityOrdered: alert.suggestedPurchase,
        unit: catalog?.unit ?? ing.baseUnit,
        expectedUnitCost: catalog
          ? toNum(catalog.unitCost)
          : toNum(ing.averageCost),
      });
      groups.set(ing.preferredSupplierId, list);
    }

    const created: string[] = [];
    for (const [supplierId, items] of groups) {
      const po = await this.createDraft({
        locationId: params.locationId,
        supplierId,
        createdById: params.createdById,
        notes: "Generada desde stock sugerido",
        items,
      });
      created.push(po.id);
    }

    return {
      created,
      message:
        created.length > 0
          ? `Se crearon ${created.length} borrador(es) de compra.`
          : "Hay stock bajo, pero sin proveedor preferido activo.",
    };
  }

  async suppliersDueToday(locationId: string, date = new Date()) {
    const day = weekdayToday(date);
    return prisma.supplier.findMany({
      where: {
        locationId,
        active: true,
        schedules: { some: { orderDay: day } },
      },
      include: {
        schedules: { where: { orderDay: day } },
        products: {
          where: { active: true },
          include: { ingredient: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }
}

export const purchaseOrderService = new PurchaseOrderService();
