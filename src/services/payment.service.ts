import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { customerService } from "@/services/customer.service";
import { inventoryService } from "@/services/inventory.service";
import { assertPaymentsCoverTotal } from "@/lib/pos-labels";
import { roundMoney } from "@/services/pricing.service";

export type PaymentLineInput = {
  method: PaymentMethod;
  amount: number;
  tipAmount?: number;
  reference?: string | null;
};

function toNum(v: Prisma.Decimal | number | string) {
  return Number(v);
}

/**
 * Closes a check with one or more payments. Idempotent inventory consumption
 * per order item via existing SALE_CONSUMPTION movements.
 */
export class PaymentService {
  async closeCheck(params: {
    checkId: string;
    payments: PaymentLineInput[];
    paidById: string;
  }) {
    if (!params.payments.length) {
      throw new Error("Agrega al menos un pago.");
    }

    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          total: Prisma.Decimal;
          orderId: string;
          customerId: string | null;
        }>
      >`
        SELECT id, status, total, "orderId", "customerId"
        FROM "Check"
        WHERE id = ${params.checkId}
        FOR UPDATE
      `;
      const checkRow = locked[0];
      if (!checkRow) throw new Error("Cuenta no encontrada.");
      if (checkRow.status !== "OPEN") {
        throw new Error("La cuenta ya está cerrada o cancelada.");
      }

      const checkTotal = toNum(checkRow.total);
      const paymentSum = roundMoney(
        params.payments.reduce((s, p) => s + p.amount, 0),
      );
      const tipSum = roundMoney(
        params.payments.reduce((s, p) => s + (p.tipAmount ?? 0), 0),
      );

      assertPaymentsCoverTotal(checkTotal, paymentSum);

      for (const payment of params.payments) {
        if (payment.amount < 0 || (payment.tipAmount ?? 0) < 0) {
          throw new Error("Montos inválidos.");
        }
        await tx.payment.create({
          data: {
            checkId: params.checkId,
            method: payment.method,
            amount: roundMoney(payment.amount),
            tipAmount: roundMoney(payment.tipAmount ?? 0),
            reference: payment.reference ?? null,
            paidById: params.paidById,
          },
        });
      }

      await tx.check.update({
        where: { id: params.checkId },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          tipTotal: tipSum,
        },
      });

      if (checkRow.customerId) {
        await customerService.recordSpendOnClose(
          { customerId: checkRow.customerId, amount: checkTotal },
          tx,
        );
      }

      const items = await tx.orderItem.findMany({
        where: {
          checkId: params.checkId,
          status: { not: "CANCELLED" },
          menuItemId: { not: null },
        },
        include: {
          menuItem: {
            include: { recipeItems: true },
          },
        },
      });

      for (const item of items) {
        if (!item.menuItem) continue;

        const already = await tx.inventoryMovement.findFirst({
          where: {
            referenceType: "ORDER",
            referenceId: item.id,
            movementType: "SALE_CONSUMPTION",
          },
        });
        if (already) continue;

        for (const recipe of item.menuItem.recipeItems) {
          const qty = toNum(recipe.quantity) * item.quantity;
          if (qty <= 0) continue;
          try {
            await inventoryService.applyStockChange(
              {
                ingredientId: recipe.ingredientId,
                quantityDelta: -qty,
                movementType: "SALE_CONSUMPTION",
                referenceType: "ORDER",
                referenceId: item.id,
                employeeId: params.paidById,
                notes: `Venta ${item.nameSnapshot} x${item.quantity}`,
              },
              tx,
            );
          } catch (error) {
            // Soft-fail insufficient stock on close: still record intended consumption
            // by allowing negative? Plan says never negative. Block close instead.
            throw new Error(
              error instanceof Error
                ? `Inventario: ${error.message}`
                : "Stock insuficiente para cerrar la cuenta.",
            );
          }
        }
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: checkRow.orderId },
        include: { checks: true },
      });

      const allClosed = order.checks.every(
        (c) =>
          c.id === params.checkId ||
          c.status === "CLOSED" ||
          c.status === "CANCELLED",
      );

      if (allClosed) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
            inventoryConsumedAt: new Date(),
          },
        });
        if (order.tableId) {
          await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: { status: "CLEANING" },
          });
        }
      }

      return {
        checkId: params.checkId,
        orderId: order.id,
        tableId: order.tableId,
        paymentSum,
        tipSum,
        allClosed,
      };
    });
  }

  async getCheckReceipt(checkId: string) {
    const check = await prisma.check.findUnique({
      where: { id: checkId },
      include: {
        payments: true,
        items: {
          where: { status: { not: "CANCELLED" } },
          include: { modifiers: true },
        },
        order: {
          include: {
            table: true,
            waiter: true,
            location: true,
          },
        },
      },
    });
    if (!check) throw new Error("Cuenta no encontrada.");
    return check;
  }
}

export const paymentService = new PaymentService();
