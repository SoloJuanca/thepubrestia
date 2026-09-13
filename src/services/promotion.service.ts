import { PromotionType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateOrderItemAmounts,
  calculateCheckTotals,
  roundMoney,
} from "@/services/pricing.service";

type Tx = Prisma.TransactionClient;

function toNum(v: { toString(): string } | number | string) {
  return Number(v);
}

export type PromoEligibility = {
  ok: true;
} | {
  ok: false;
  reason: string;
};

export function isPromotionInWindow(
  promo: { active: boolean; startsAt: Date; endsAt: Date | null },
  now = new Date(),
): PromoEligibility {
  if (!promo.active) return { ok: false, reason: "La promoción no está activa." };
  if (promo.startsAt > now) {
    return { ok: false, reason: "La promoción aún no inicia." };
  }
  if (promo.endsAt && promo.endsAt < now) {
    return { ok: false, reason: "La promoción expiró." };
  }
  return { ok: true };
}

export class PromotionService {
  async assertEligible(params: {
    promotionId: string;
    customerId?: string | null;
    now?: Date;
  }): Promise<PromoEligibility> {
    const promo = await prisma.promotion.findUnique({
      where: { id: params.promotionId },
      include: {
        customers: params.customerId
          ? { where: { customerId: params.customerId } }
          : false,
      },
    });
    if (!promo) return { ok: false, reason: "Promoción no encontrada." };

    const window = isPromotionInWindow(promo, params.now);
    if (!window.ok) return window;

    if (promo.totalLimit != null) {
      const used = await prisma.check.count({
        where: {
          promotionId: promo.id,
          status: { in: ["OPEN", "CLOSED"] },
        },
      });
      if (used >= promo.totalLimit) {
        return { ok: false, reason: "Límite total de promoción alcanzado." };
      }
    }

    if (params.customerId && promo.perCustomerLimit != null) {
      const usedByCustomer = await prisma.check.count({
        where: {
          promotionId: promo.id,
          customerId: params.customerId,
          status: { in: ["OPEN", "CLOSED"] },
        },
      });
      if (usedByCustomer >= promo.perCustomerLimit) {
        return {
          ok: false,
          reason: "Límite por cliente alcanzado para esta promoción.",
        };
      }
    }

    return { ok: true };
  }

  /**
   * Applies a promotion to an open check and recalculates line discounts + totals.
   */
  async applyToCheck(params: {
    checkId: string;
    promotionId: string;
    customerPromotionId?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const check = await tx.check.findUnique({
        where: { id: params.checkId },
        include: {
          items: {
            where: { status: { not: "CANCELLED" } },
            include: { menuItem: true },
          },
        },
      });
      if (!check) throw new Error("Cuenta no encontrada.");
      if (check.status !== "OPEN") {
        throw new Error("Solo se pueden aplicar promociones a cuentas abiertas.");
      }
      if (check.promotionId) {
        throw new Error("La cuenta ya tiene una promoción. Quítala primero.");
      }

      const promo = await tx.promotion.findUnique({
        where: { id: params.promotionId },
        include: { products: true, categories: true },
      });
      if (!promo) throw new Error("Promoción no encontrada.");

      const eligible = await this.assertEligible({
        promotionId: promo.id,
        customerId: check.customerId,
      });
      if (!eligible.ok) throw new Error(eligible.reason);

      const productIds = new Set(promo.products.map((p) => p.menuItemId));
      const categoryIds = new Set(promo.categories.map((c) => c.categoryId));
      const scoped =
        !promo.appliesToEntireCheck &&
        (productIds.size > 0 || categoryIds.size > 0);

      // Reset discounts first
      for (const item of check.items) {
        const amounts = calculateOrderItemAmounts({
          basePrice: toNum(item.unitPrice),
          modifiersTotal: toNum(item.modifiersTotal),
          discountAmount: 0,
          taxRate: item.menuItem ? toNum(item.menuItem.taxRate) : 0,
          quantity: item.quantity,
        });
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            discountAmount: amounts.discountAmount,
            taxAmount: amounts.taxAmount,
            lineTotal: amounts.lineTotal,
          },
        });
      }

      const fresh = await tx.orderItem.findMany({
        where: { checkId: check.id, status: { not: "CANCELLED" } },
        include: { menuItem: true },
      });

      const eligibleLines = fresh.filter((item) => {
        if (!scoped) return true;
        if (!item.menuItem) return false;
        return (
          productIds.has(item.menuItemId ?? "") ||
          categoryIds.has(item.menuItem.categoryId)
        );
      });

      if (!eligibleLines.length) {
        throw new Error("Ningún producto de la cuenta aplica a esta promoción.");
      }

      const eligibleSubtotal = eligibleLines.reduce(
        (s, i) =>
          s + (toNum(i.unitPrice) + toNum(i.modifiersTotal)) * i.quantity,
        0,
      );

      let totalDiscount = 0;
      if (promo.type === PromotionType.PERCENTAGE) {
        totalDiscount = roundMoney(
          eligibleSubtotal * (toNum(promo.amount) / 100),
        );
      } else if (
        promo.type === PromotionType.FIXED_AMOUNT ||
        promo.type === PromotionType.SPECIAL_PRICE
      ) {
        totalDiscount = Math.min(toNum(promo.amount), eligibleSubtotal);
      } else if (promo.type === PromotionType.FREE_PRODUCT) {
        const cheapest = [...eligibleLines].sort(
          (a, b) =>
            toNum(a.unitPrice) +
            toNum(a.modifiersTotal) -
            (toNum(b.unitPrice) + toNum(b.modifiersTotal)),
        )[0];
        if (cheapest) {
          totalDiscount = roundMoney(
            toNum(cheapest.unitPrice) + toNum(cheapest.modifiersTotal),
          );
        }
      }

      // Distribute discount proportionally across eligible lines
      let remaining = totalDiscount;
      for (let i = 0; i < eligibleLines.length; i++) {
        const item = eligibleLines[i]!;
        const lineGross =
          (toNum(item.unitPrice) + toNum(item.modifiersTotal)) * item.quantity;
        const share =
          i === eligibleLines.length - 1
            ? remaining
            : roundMoney((lineGross / eligibleSubtotal) * totalDiscount);
        remaining = roundMoney(remaining - share);
        const perUnit = item.quantity > 0 ? share / item.quantity : 0;
        const taxRate = item.menuItem ? toNum(item.menuItem.taxRate) : 0;
        const amounts = calculateOrderItemAmounts({
          basePrice: toNum(item.unitPrice),
          modifiersTotal: toNum(item.modifiersTotal),
          discountAmount: perUnit,
          taxRate,
          quantity: item.quantity,
        });
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            discountAmount: amounts.discountAmount,
            taxAmount: amounts.taxAmount,
            lineTotal: amounts.lineTotal,
          },
        });
      }

      await tx.check.update({
        where: { id: check.id },
        data: { promotionId: promo.id },
      });

      if (params.customerPromotionId) {
        const wallet = await tx.customerPromotion.findUnique({
          where: { id: params.customerPromotionId },
        });
        if (!wallet || wallet.used) {
          throw new Error("Cupón de cliente no válido o ya usado.");
        }
        if (wallet.expiresAt && wallet.expiresAt < new Date()) {
          throw new Error("Cupón de cliente expirado.");
        }
        if (wallet.promotionId !== promo.id) {
          throw new Error("El cupón no corresponde a esta promoción.");
        }
        await tx.customerPromotion.update({
          where: { id: wallet.id },
          data: { used: true, usedAt: new Date() },
        });
      }

      await this.recalc(tx, check.id);
      return tx.check.findUniqueOrThrow({ where: { id: check.id } });
    });
  }

  async removeFromCheck(checkId: string) {
    return prisma.$transaction(async (tx) => {
      const check = await tx.check.findUnique({
        where: { id: checkId },
        include: {
          items: {
            where: { status: { not: "CANCELLED" } },
            include: { menuItem: true },
          },
        },
      });
      if (!check) throw new Error("Cuenta no encontrada.");
      if (check.status !== "OPEN") {
        throw new Error("Solo cuentas abiertas.");
      }

      for (const item of check.items) {
        const amounts = calculateOrderItemAmounts({
          basePrice: toNum(item.unitPrice),
          modifiersTotal: toNum(item.modifiersTotal),
          discountAmount: 0,
          taxRate: item.menuItem ? toNum(item.menuItem.taxRate) : 0,
          quantity: item.quantity,
        });
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            discountAmount: amounts.discountAmount,
            taxAmount: amounts.taxAmount,
            lineTotal: amounts.lineTotal,
          },
        });
      }

      await tx.check.update({
        where: { id: checkId },
        data: { promotionId: null },
      });
      await this.recalc(tx, checkId);
      return tx.check.findUniqueOrThrow({ where: { id: checkId } });
    });
  }

  private async recalc(tx: Tx, checkId: string) {
    const items = await tx.orderItem.findMany({
      where: { checkId, status: { not: "CANCELLED" } },
    });
    const totals = calculateCheckTotals(
      items.map((i) => ({
        quantity: i.quantity,
        unitPrice: toNum(i.unitPrice),
        modifiersTotal: toNum(i.modifiersTotal),
        discountAmount: toNum(i.discountAmount),
        taxAmount: toNum(i.taxAmount),
        lineTotal: toNum(i.lineTotal),
      })),
    );
    await tx.check.update({
      where: { id: checkId },
      data: {
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
      },
    });
  }
}

export const promotionService = new PromotionService();
