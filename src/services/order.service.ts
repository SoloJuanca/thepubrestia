import {
  OrderStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertAllChecksPaid } from "@/lib/pos-labels";
import {
  calculateCheckTotals,
  calculateOrderItemAmounts,
  roundMoney,
} from "@/services/pricing.service";

type Tx = Prisma.TransactionClient;

function toNum(v: Prisma.Decimal | number | string) {
  return Number(v);
}

async function recalcCheck(tx: Tx, checkId: string) {
  const items = await tx.orderItem.findMany({
    where: { checkId, status: { not: "CANCELLED" } },
  });
  const totals = calculateCheckTotals(
    items.map((item) => ({
      quantity: item.quantity,
      unitPrice: toNum(item.unitPrice),
      modifiersTotal: toNum(item.modifiersTotal),
      discountAmount: toNum(item.discountAmount),
      taxAmount: toNum(item.taxAmount),
      lineTotal: toNum(item.lineTotal),
    })),
  );
  return tx.check.update({
    where: { id: checkId },
    data: {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
    },
  });
}

export class OrderService {
  async openTable(params: {
    locationId: string;
    tableId: string;
    waiterId: string;
    checkName?: string;
    partySize?: number;
    notes?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const table = await tx.restaurantTable.findFirst({
        where: {
          id: params.tableId,
          locationId: params.locationId,
          active: true,
        },
      });
      if (!table) throw new Error("Mesa no encontrada.");

      const openOrder = await tx.order.findFirst({
        where: {
          tableId: params.tableId,
          status: { notIn: ["CLOSED", "CANCELLED"] },
        },
      });
      if (openOrder) {
        return openOrder;
      }

      if (table.status === "RESERVED") {
        // allow opening reserved tables
      } else if (table.status === "CLEANING") {
        throw new Error("La mesa está en limpieza.");
      }

      const lastTicket = await tx.order.findFirst({
        where: { locationId: params.locationId, ticketNumber: { not: null } },
        orderBy: { ticketNumber: "desc" },
        select: { ticketNumber: true },
      });
      const ticketNumber = (lastTicket?.ticketNumber ?? 0) + 1;
      const partySize = Math.max(
        1,
        Math.min(params.partySize ?? table.capacity, 40),
      );

      const order = await tx.order.create({
        data: {
          locationId: params.locationId,
          tableId: params.tableId,
          waiterId: params.waiterId,
          status: "OPEN",
          ticketNumber,
          partySize,
          notes: params.notes ?? null,
          checks: {
            create: {
              name: params.checkName?.trim() || "Cuenta de Mesa",
              status: "OPEN",
            },
          },
          seats: {
            create: Array.from({ length: partySize }, (_, i) => ({
              label: `Persona ${i + 1}`,
              sortOrder: i,
            })),
          },
        },
        include: { checks: true, seats: true },
      });

      await tx.restaurantTable.update({
        where: { id: params.tableId },
        data: { status: "OCCUPIED" },
      });

      return order;
    });
  }

  async addCheck(params: {
    orderId: string;
    name: string;
    customerId?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: params.orderId } });
      if (!order || ["CLOSED", "CANCELLED"].includes(order.status)) {
        throw new Error("La orden no admite nuevas cuentas.");
      }
      return tx.check.create({
        data: {
          orderId: params.orderId,
          name: params.name.trim() || "Cuenta",
          customerId: params.customerId ?? null,
          status: "OPEN",
        },
      });
    });
  }

  async renameCheck(params: { checkId: string; name: string }) {
    const check = await prisma.check.findUnique({ where: { id: params.checkId } });
    if (!check || check.status !== "OPEN") {
      throw new Error("Solo se pueden renombrar cuentas abiertas.");
    }
    return prisma.check.update({
      where: { id: params.checkId },
      data: { name: params.name.trim() || "Cuenta" },
    });
  }

  async addItem(params: {
    checkId: string;
    menuItemId: string;
    quantity: number;
    modifierOptionIds: string[];
    notes?: string | null;
    seatId?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const check = await tx.check.findUnique({
        where: { id: params.checkId },
        include: { order: true },
      });
      if (!check || check.status !== "OPEN") {
        throw new Error("La cuenta no está abierta.");
      }
      if (["CLOSED", "CANCELLED"].includes(check.order.status)) {
        throw new Error("La orden está cerrada.");
      }

      if (params.seatId) {
        const seat = await tx.seat.findFirst({
          where: { id: params.seatId, orderId: check.orderId },
        });
        if (!seat) throw new Error("Persona no encontrada en esta mesa.");
      }

      const menuItem = await tx.menuItem.findFirst({
        where: {
          id: params.menuItemId,
          locationId: check.order.locationId,
          active: true,
          available: true,
        },
        include: {
          modifierGroups: { include: { options: true } },
        },
      });
      if (!menuItem) throw new Error("Producto no disponible.");

      const selectedOptions = menuItem.modifierGroups.flatMap((g) =>
        g.options.filter((o) => params.modifierOptionIds.includes(o.id)),
      );

      for (const group of menuItem.modifierGroups) {
        const picked = group.options.filter((o) =>
          params.modifierOptionIds.includes(o.id),
        ).length;
        if (group.required && picked < Math.max(1, group.minSelections)) {
          throw new Error(`El grupo "${group.name}" es requerido.`);
        }
        if (picked < group.minSelections) {
          throw new Error(
            `El grupo "${group.name}" requiere al menos ${group.minSelections}.`,
          );
        }
        if (picked > group.maxSelections) {
          throw new Error(
            `El grupo "${group.name}" permite máximo ${group.maxSelections}.`,
          );
        }
      }

      const modifiersTotal = selectedOptions.reduce(
        (sum, o) => sum + toNum(o.priceDelta),
        0,
      );
      const qty = Math.max(1, params.quantity);
      const amounts = calculateOrderItemAmounts({
        basePrice: toNum(menuItem.price),
        modifiersTotal,
        taxRate: toNum(menuItem.taxRate),
        quantity: qty,
      });

      const item = await tx.orderItem.create({
        data: {
          checkId: params.checkId,
          seatId: params.seatId ?? null,
          menuItemId: menuItem.id,
          nameSnapshot: menuItem.name,
          unitPrice: amounts.unitPrice,
          quantity: qty,
          modifiersTotal: amounts.modifiersTotal,
          discountAmount: amounts.discountAmount,
          taxAmount: amounts.taxAmount,
          lineTotal: amounts.lineTotal,
          status: "OPEN",
          notes: params.notes ?? null,
          modifiers: {
            create: selectedOptions.map((o) => ({
              modifierOptionId: o.id,
              nameSnapshot: o.name,
              priceDeltaSnapshot: toNum(o.priceDelta),
            })),
          },
        },
        include: { modifiers: true },
      });

      await recalcCheck(tx, params.checkId);
      return item;
    });
  }

  async updateItemQuantity(params: {
    orderItemId: string;
    quantity: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({
        where: { id: params.orderItemId },
        include: { check: true, menuItem: true },
      });
      if (!item || item.check.status !== "OPEN") {
        throw new Error("No se puede modificar este producto.");
      }
      if (item.status !== "OPEN") {
        throw new Error("El producto ya fue enviado a cocina.");
      }
      const qty = Math.max(1, params.quantity);
      const taxRate = item.menuItem ? toNum(item.menuItem.taxRate) : 0;
      const perUnitDiscount =
        toNum(item.discountAmount) / Math.max(1, item.quantity);

      const amounts = calculateOrderItemAmounts({
        basePrice: toNum(item.unitPrice),
        modifiersTotal: toNum(item.modifiersTotal),
        discountAmount: perUnitDiscount,
        taxRate,
        quantity: qty,
      });

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          quantity: qty,
          discountAmount: amounts.discountAmount,
          taxAmount: amounts.taxAmount,
          lineTotal: amounts.lineTotal,
        },
      });
      await recalcCheck(tx, item.checkId);
    });
  }

  async removeItem(params: { orderItemId: string }) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({
        where: { id: params.orderItemId },
        include: { check: true },
      });
      if (!item || item.check.status !== "OPEN") {
        throw new Error("No se puede eliminar este producto.");
      }
      if (item.status !== "OPEN") {
        throw new Error("El producto ya fue enviado a cocina.");
      }
      await tx.orderItem.delete({ where: { id: item.id } });
      await recalcCheck(tx, item.checkId);
    });
  }

  async sendCheckToKitchen(params: { checkId: string }) {
    return prisma.$transaction(async (tx) => {
      const check = await tx.check.findUnique({
        where: { id: params.checkId },
        include: { order: true },
      });
      if (!check || check.status !== "OPEN") {
        throw new Error("Cuenta inválida.");
      }

      const result = await tx.orderItem.updateMany({
        where: { checkId: params.checkId, status: "OPEN" },
        data: {
          status: "SENT_TO_KITCHEN",
          sentToKitchenAt: new Date(),
        },
      });

      if (result.count === 0) {
        throw new Error("No hay productos nuevos para enviar.");
      }

      if (check.order.status === "OPEN") {
        await tx.order.update({
          where: { id: check.orderId },
          data: { status: "SENT_TO_KITCHEN" },
        });
      }

      return result.count;
    });
  }

  async updateKitchenItemStatus(params: {
    orderItemId: string;
    status: Extract<
      OrderStatus,
      "PREPARING" | "READY" | "DELIVERED" | "CANCELLED"
    >;
  }) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({
        where: { id: params.orderItemId },
        include: { check: { include: { order: true } } },
      });
      if (!item) throw new Error("Producto no encontrado.");

      const allowedFrom: Record<string, OrderStatus[]> = {
        PREPARING: ["SENT_TO_KITCHEN", "PREPARING"],
        READY: ["PREPARING", "SENT_TO_KITCHEN", "READY"],
        DELIVERED: ["READY", "DELIVERED"],
        CANCELLED: ["SENT_TO_KITCHEN", "PREPARING", "OPEN"],
      };
      if (!allowedFrom[params.status].includes(item.status)) {
        throw new Error(
          `No se puede pasar de ${item.status} a ${params.status}.`,
        );
      }

      const data: Prisma.OrderItemUpdateInput = {
        status: params.status,
      };
      if (params.status === "READY") data.readyAt = new Date();
      if (params.status === "DELIVERED") data.deliveredAt = new Date();

      await tx.orderItem.update({ where: { id: item.id }, data });

      if (params.status === "PREPARING" || params.status === "READY") {
        await tx.order.update({
          where: { id: item.check.orderId },
          data: {
            status:
              params.status === "READY" ? "READY" : "PREPARING",
          },
        });
      }

      return true;
    });
  }

  async moveItemsToCheck(params: {
    orderItemIds: string[];
    targetCheckId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const target = await tx.check.findUnique({
        where: { id: params.targetCheckId },
        include: { order: true },
      });
      if (!target || target.status !== "OPEN") {
        throw new Error("Cuenta destino inválida.");
      }

      const items = await tx.orderItem.findMany({
        where: { id: { in: params.orderItemIds } },
        include: { check: true },
      });
      if (items.length !== params.orderItemIds.length) {
        throw new Error("Algunos productos no existen.");
      }

      const sourceCheckIds = new Set<string>();
      for (const item of items) {
        if (item.check.orderId !== target.orderId) {
          throw new Error("Los productos deben ser de la misma orden.");
        }
        if (item.check.status !== "OPEN") {
          throw new Error("Solo cuentas abiertas.");
        }
        sourceCheckIds.add(item.checkId);
      }

      await tx.orderItem.updateMany({
        where: { id: { in: params.orderItemIds } },
        data: { checkId: params.targetCheckId },
      });

      for (const checkId of [...sourceCheckIds, params.targetCheckId]) {
        await recalcCheck(tx, checkId);
      }
    });
  }

  /** Create N new empty checks for equal split workflow. */
  async splitEqualChecks(params: { orderId: string; parts: number }) {
    if (params.parts < 2 || params.parts > 20) {
      throw new Error("Partes debe ser entre 2 y 20.");
    }
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
        include: { checks: { where: { status: "OPEN" } } },
      });
      if (!order || ["CLOSED", "CANCELLED"].includes(order.status)) {
        throw new Error("Orden inválida.");
      }
      const created = [];
      for (let i = 1; i <= params.parts; i++) {
        created.push(
          await tx.check.create({
            data: {
              orderId: params.orderId,
              name: `Parte ${i}`,
              status: "OPEN",
            },
          }),
        );
      }
      return created;
    });
  }

  /** Create checks labeled with custom amounts (payment split in Phase 5). */
  async splitCustomAmountChecks(params: {
    orderId: string;
    amounts: number[];
  }) {
    const amounts = params.amounts.map(roundMoney).filter((a) => a > 0);
    if (amounts.length < 2) {
      throw new Error("Indica al menos 2 montos.");
    }
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: params.orderId } });
      if (!order || ["CLOSED", "CANCELLED"].includes(order.status)) {
        throw new Error("Orden inválida.");
      }
      const created = [];
      for (const amount of amounts) {
        created.push(
          await tx.check.create({
            data: {
              orderId: params.orderId,
              name: `Parte $${amount.toFixed(2)}`,
              status: "OPEN",
            },
          }),
        );
      }
      return created;
    });
  }

  async setTableStatus(params: {
    tableId: string;
    status:
      | "AVAILABLE"
      | "OCCUPIED"
      | "RESERVED"
      | "CLEANING"
      | "AWAITING_PAYMENT";
  }) {
    return prisma.restaurantTable.update({
      where: { id: params.tableId },
      data: { status: params.status },
    });
  }

  async addSeat(orderId: string) {
    const count = await prisma.seat.count({ where: { orderId } });
    const seat = await prisma.seat.create({
      data: {
        orderId,
        label: `Persona ${count + 1}`,
        sortOrder: count,
      },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { partySize: count + 1 },
    });
    return seat;
  }

  async renameSeat(params: { seatId: string; displayName?: string | null }) {
    return prisma.seat.update({
      where: { id: params.seatId },
      data: {
        displayName: params.displayName?.trim() || null,
      },
    });
  }

  async assignItemSeat(params: {
    orderItemId: string;
    seatId: string | null;
  }) {
    return prisma.orderItem.update({
      where: { id: params.orderItemId },
      data: { seatId: params.seatId },
    });
  }

  /**
   * Creates one open check per seat and moves items by seat assignment.
   * Unassigned items stay on the primary check.
   */
  async splitByConsumption(params: { orderId: string }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
        include: {
          seats: { orderBy: { sortOrder: "asc" } },
          checks: {
            where: { status: "OPEN" },
            include: { items: { where: { status: { not: "CANCELLED" } } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!order) throw new Error("Orden no encontrada.");
      if (!order.seats.length) {
        throw new Error("Agrega personas antes de dividir por consumo.");
      }

      const primary = order.checks[0];
      if (!primary) throw new Error("No hay cuenta abierta.");

      const seatChecks = new Map<string, string>();
      for (const seat of order.seats) {
        const check = await tx.check.create({
          data: {
            orderId: order.id,
            name: seat.displayName?.trim() || seat.label,
            status: "OPEN",
          },
        });
        seatChecks.set(seat.id, check.id);
      }

      for (const check of order.checks) {
        for (const item of check.items) {
          if (!item.seatId) continue;
          const targetId = seatChecks.get(item.seatId);
          if (!targetId || targetId === check.id) continue;
          await tx.orderItem.update({
            where: { id: item.id },
            data: { checkId: targetId },
          });
        }
      }

      for (const checkId of [primary.id, ...seatChecks.values()]) {
        await recalcCheck(tx, checkId);
      }

      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: "AWAITING_PAYMENT" },
        });
      }

      return { checkCount: 1 + seatChecks.size };
    });
  }

  async closeOrderIfEmpty(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          checks: { include: { items: true, payments: true } },
          table: true,
        },
      });
      if (!order) return;

      const hasOpenItems = order.checks.some((c) =>
        c.items.some((i) => i.status !== "CANCELLED" && c.status === "OPEN"),
      );
      if (hasOpenItems) return;

      // Phase 4: allow marking table cleaning when waiter ends session without payments
      // Full close with payments is Phase 5.
    });
  }

  async endTableSession(params: { orderId: string; forceCleaning?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
        include: {
          checks: { include: { items: true } },
        },
      });
      if (!order) throw new Error("Orden no encontrada.");
      if (["CLOSED", "CANCELLED"].includes(order.status)) {
        throw new Error("La orden ya está cerrada.");
      }

      if (!params.forceCleaning) {
        assertAllChecksPaid(order.checks);
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      });
      await tx.check.updateMany({
        where: { orderId: order.id, status: "OPEN" },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: "CLEANING" },
        });
      }
    });
  }
}

export const orderService = new OrderService();

/** Exported for actions that need totals refresh */
export async function recalculateCheckTotals(
  checkId: string,
  client: PrismaClient | Tx = prisma,
) {
  if ("$transaction" in client) {
    return client.$transaction((tx) => recalcCheck(tx, checkId));
  }
  return recalcCheck(client as Tx, checkId);
}
