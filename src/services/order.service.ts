import {
  OrderStatus,
  Prisma,
  type PrismaClient,
  type TableStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertAllChecksPaid } from "@/lib/pos-labels";
import {
  areAdjacent,
  joinPrimaryCode,
  parseTableCode,
} from "@/lib/table-floor";
import {
  calculateCheckTotals,
  calculateOrderItemAmounts,
  roundMoney,
} from "@/services/pricing.service";

type Tx = Prisma.TransactionClient;

function toNum(v: Prisma.Decimal | number | string) {
  return Number(v);
}

async function syncJoinedTableStatus(
  tx: Tx,
  tableId: string,
  status: TableStatus,
) {
  await tx.restaurantTable.update({
    where: { id: tableId },
    data: { status },
  });
  const children = await tx.restaurantTable.findMany({
    where: { joinedToId: tableId },
    select: { id: true },
  });
  for (const child of children) {
    await syncJoinedTableStatus(tx, child.id, status);
  }
}

async function joinedCapacity(tx: Tx, tableId: string, baseCapacity: number) {
  const satellites = await tx.restaurantTable.findMany({
    where: { joinedToId: tableId, active: true },
    select: { id: true, capacity: true },
  });
  let total = baseCapacity;
  for (const sat of satellites) {
    total += await joinedCapacity(tx, sat.id, sat.capacity);
  }
  return total;
}

async function hasOpenOrderOnTree(tx: Tx, tableId: string): Promise<boolean> {
  const open = await tx.order.findFirst({
    where: {
      tableId,
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    select: { id: true },
  });
  if (open) return true;
  const children = await tx.restaurantTable.findMany({
    where: { joinedToId: tableId },
    select: { id: true },
  });
  for (const child of children) {
    if (await hasOpenOrderOnTree(tx, child.id)) return true;
  }
  return false;
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

      if (table.joinedToId) {
        throw new Error(
          "Esta mesa está juntada. Abre la mesa principal del par.",
        );
      }

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
      const capacity = await joinedCapacity(tx, table.id, table.capacity);
      const partySize = Math.max(
        1,
        Math.min(params.partySize ?? capacity, 40),
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

      await syncJoinedTableStatus(tx, params.tableId, "OCCUPIED");

      return order;
    });
  }

  /** Takeout order identified by the customer's name. No table. */
  async openTakeout(params: {
    locationId: string;
    waiterId: string;
    guestName: string;
    notes?: string | null;
  }) {
    const guestName = params.guestName.trim();
    if (!guestName) throw new Error("Escribe el nombre del pedido.");

    return prisma.$transaction(async (tx) => {
      const lastTicket = await tx.order.findFirst({
        where: { locationId: params.locationId, ticketNumber: { not: null } },
        orderBy: { ticketNumber: "desc" },
        select: { ticketNumber: true },
      });
      const ticketNumber = (lastTicket?.ticketNumber ?? 0) + 1;

      return tx.order.create({
        data: {
          locationId: params.locationId,
          tableId: null,
          guestName,
          waiterId: params.waiterId,
          status: "OPEN",
          ticketNumber,
          partySize: 1,
          notes: params.notes?.trim() || null,
          checks: {
            create: {
              name: guestName,
              status: "OPEN",
            },
          },
          seats: {
            create: {
              label: guestName,
              sortOrder: 0,
            },
          },
        },
        include: { checks: true, seats: true },
      });
    });
  }

  /**
   * Join two adjacent floor roots (mitades or already-joined blocks).
   * Primaries: 10+11→11, 12+13→12, 11+12→11.
   */
  async joinTables(params: { tableId: string; partnerId: string }) {
    return prisma.$transaction(async (tx) => {
      const [a, b] = await Promise.all([
        tx.restaurantTable.findUnique({ where: { id: params.tableId } }),
        tx.restaurantTable.findUnique({ where: { id: params.partnerId } }),
      ]);
      if (!a?.active || !b?.active) throw new Error("Mesa no encontrada.");
      if (a.locationId !== b.locationId) {
        throw new Error("Las mesas deben ser de la misma sucursal.");
      }

      const codeA = parseTableCode(a.name);
      const codeB = parseTableCode(b.name);
      if (codeA == null || codeB == null) {
        throw new Error("Solo se pueden juntar mesas del piso (10–83).");
      }
      if (!areAdjacent(codeA, codeB)) {
        throw new Error(
          "Solo se pueden juntar mesas adyacentes (ej. 10-11, 11-12, 12-13).",
        );
      }

      if (a.joinedToId || b.joinedToId) {
        throw new Error("Usa la mesa principal de cada bloque para juntar.");
      }

      for (const t of [a, b]) {
        if (t.status !== "AVAILABLE" && t.status !== "RESERVED") {
          throw new Error("Solo se pueden juntar mesas libres.");
        }
        if (await hasOpenOrderOnTree(tx, t.id)) {
          throw new Error("No se pueden juntar mesas con cuenta abierta.");
        }
      }

      const primaryCode = joinPrimaryCode(codeA, codeB);
      const primary = primaryCode === codeA ? a : b;
      const satellite = primary.id === a.id ? b : a;

      await tx.restaurantTable.update({
        where: { id: satellite.id },
        data: {
          joinedToId: primary.id,
          status: primary.status,
        },
      });
      await syncJoinedTableStatus(tx, satellite.id, primary.status);

      return { primaryId: primary.id, satelliteId: satellite.id };
    });
  }

  /**
   * Detach a satellite (or all direct satellites) from its primary.
   * Example: separate 11 with satellite 10 → mesas 10 y 11.
   */
  async separateTables(params: { tableId: string; satelliteId?: string }) {
    return prisma.$transaction(async (tx) => {
      const table = await tx.restaurantTable.findUnique({
        where: { id: params.tableId },
      });
      if (!table?.active) throw new Error("Mesa no encontrada.");

      let primaryId = table.id;
      let cursor = table;
      while (cursor.joinedToId) {
        const parent = await tx.restaurantTable.findUnique({
          where: { id: cursor.joinedToId },
        });
        if (!parent) break;
        cursor = parent;
        primaryId = parent.id;
      }

      // If caller passed a satellite, detach from its direct parent
      if (params.satelliteId) {
        const satellite = await tx.restaurantTable.findUnique({
          where: { id: params.satelliteId },
        });
        if (!satellite?.active || !satellite.joinedToId) {
          throw new Error("Esa mesa no está juntada.");
        }
        const parent = await tx.restaurantTable.findUnique({
          where: { id: satellite.joinedToId },
        });
        if (!parent) throw new Error("Mesa principal no encontrada.");

        if (await hasOpenOrderOnTree(tx, parent.id)) {
          throw new Error("Cierra la cuenta antes de separar en 2 mesas.");
        }
        if (
          parent.status === "OCCUPIED" ||
          parent.status === "AWAITING_PAYMENT"
        ) {
          throw new Error("No se pueden separar mesas ocupadas.");
        }

        await tx.restaurantTable.update({
          where: { id: satellite.id },
          data: { joinedToId: null, status: parent.status },
        });
        await syncJoinedTableStatus(tx, satellite.id, parent.status);

        return { primaryId: parent.id, separated: 1 };
      }

      const primary = await tx.restaurantTable.findUnique({
        where: { id: primaryId },
      });
      if (!primary) throw new Error("Mesa principal no encontrada.");

      if (await hasOpenOrderOnTree(tx, primary.id)) {
        throw new Error("Cierra la cuenta antes de separar en 2 mesas.");
      }
      if (
        primary.status === "OCCUPIED" ||
        primary.status === "AWAITING_PAYMENT"
      ) {
        throw new Error("No se pueden separar mesas ocupadas.");
      }

      const satellites = await tx.restaurantTable.findMany({
        where: { joinedToId: primary.id },
      });
      if (satellites.length === 0) {
        throw new Error("Esta mesa no está juntada.");
      }

      for (const sat of satellites) {
        await tx.restaurantTable.update({
          where: { id: sat.id },
          data: { joinedToId: null, status: primary.status },
        });
        await syncJoinedTableStatus(tx, sat.id, primary.status);
      }

      return { primaryId: primary.id, separated: satellites.length };
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
          notes: params.notes?.trim() || null,
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

  async updateItemNotes(params: { orderItemId: string; notes?: string | null }) {
    const item = await prisma.orderItem.findUnique({
      where: { id: params.orderItemId },
      include: { check: { include: { order: true } } },
    });
    if (!item || item.status === "CANCELLED" || item.check.status !== "OPEN") {
      throw new Error("No se puede anotar este producto.");
    }
    if (["CLOSED", "CANCELLED"].includes(item.check.order.status)) {
      throw new Error("La orden está cerrada.");
    }
    return prisma.orderItem.update({
      where: { id: item.id },
      data: { notes: params.notes?.trim() || null },
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

      // Only items that need kitchen prep (skip packaged beverages, etc.)
      const openItems = await tx.orderItem.findMany({
        where: { checkId: params.checkId, status: "OPEN" },
        include: { menuItem: { select: { requiresPrep: true } } },
      });
      const prepIds = openItems
        .filter((item) => item.menuItem?.requiresPrep !== false)
        .map((item) => item.id);

      if (prepIds.length === 0) {
        throw new Error(
          "No hay productos de cocina para enviar (solo bebidas/empaquetados).",
        );
      }

      const result = await tx.orderItem.updateMany({
        where: { id: { in: prepIds } },
        data: {
          status: "SENT_TO_KITCHEN",
          sentToKitchenAt: new Date(),
        },
      });

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

      if (params.status === "DELIVERED") {
        const stillInKitchen = await tx.orderItem.count({
          where: {
            id: { not: item.id },
            status: { in: ["SENT_TO_KITCHEN", "PREPARING", "READY"] },
            check: { orderId: item.check.orderId },
          },
        });
        if (stillInKitchen === 0 && item.check.order.status !== "CLOSED") {
          await tx.order.update({
            where: { id: item.check.orderId },
            data: { status: "DELIVERED" },
          });
        }
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
    return prisma.$transaction(async (tx) => {
      const table = await tx.restaurantTable.findUnique({
        where: { id: params.tableId },
      });
      if (!table) throw new Error("Mesa no encontrada.");
      const targetId = table.joinedToId ?? table.id;
      await syncJoinedTableStatus(tx, targetId, params.status);
      return tx.restaurantTable.findUniqueOrThrow({ where: { id: targetId } });
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
        await syncJoinedTableStatus(tx, order.tableId, "AWAITING_PAYMENT");
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
        await syncJoinedTableStatus(tx, order.tableId, "CLEANING");
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
