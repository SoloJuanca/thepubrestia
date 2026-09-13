import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/services/pricing.service";

function toNum(v: Prisma.Decimal | number | string) {
  return Number(v);
}

/** Calendar date as UTC midnight for Prisma `@db.Date`. */
function toDateOnly(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Local calendar-day window for timestamp filters (paidAt, closedAt, …). */
function localDayRange(dateOnlyUtc: Date) {
  const y = dateOnlyUtc.getUTCFullYear();
  const m = dateOnlyUtc.getUTCMonth();
  const d = dateOnlyUtc.getUTCDate();
  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d + 1, 0, 0, 0, 0);
  return { start, end };
}

export class DailyCloseService {
  async preview(locationId: string, businessDate: Date) {
    const day = toDateOnly(businessDate);
    const { start, end } = localDayRange(day);

    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { gte: start, lt: end },
        check: { order: { locationId } },
      },
      include: {
        check: true,
      },
    });

    const closedChecks = await prisma.check.findMany({
      where: {
        status: "CLOSED",
        closedAt: { gte: start, lt: end },
        order: { locationId },
      },
    });

    const cancelledOrders = await prisma.order.findMany({
      where: {
        locationId,
        status: "CANCELLED",
        cancelledAt: { gte: start, lt: end },
      },
      include: { checks: true },
    });

    const waste = await prisma.wasteRecord.findMany({
      where: {
        locationId,
        createdAt: { gte: start, lt: end },
      },
      include: { ingredient: true },
    });

    const ordersClosed = await prisma.order.count({
      where: {
        locationId,
        status: "CLOSED",
        closedAt: { gte: start, lt: end },
      },
    });

    let cashExpected = 0;
    let cardTotal = 0;
    let transferTotal = 0;
    let tipsTotal = 0;

    for (const p of payments) {
      tipsTotal += toNum(p.tipAmount);
      if (p.method === "CASH") cashExpected += toNum(p.amount);
      if (p.method === "CARD") cardTotal += toNum(p.amount);
      if (p.method === "TRANSFER") transferTotal += toNum(p.amount);
    }

    const salesTotal = roundMoney(
      closedChecks.reduce((s, c) => s + toNum(c.total), 0),
    );
    const discountsTotal = roundMoney(
      closedChecks.reduce((s, c) => s + toNum(c.discountTotal), 0),
    );
    const cancellationsTotal = roundMoney(
      cancelledOrders.reduce(
        (s, o) => s + o.checks.reduce((cs, c) => cs + toNum(c.total), 0),
        0,
      ),
    );
    const wasteTotal = roundMoney(
      waste.reduce(
        (s, w) => s + toNum(w.quantity) * toNum(w.ingredient.averageCost),
        0,
      ),
    );

    return {
      businessDate: day,
      salesTotal,
      cashExpected: roundMoney(cashExpected),
      cardTotal: roundMoney(cardTotal),
      transferTotal: roundMoney(transferTotal),
      tipsTotal: roundMoney(tipsTotal),
      discountsTotal,
      cancellationsTotal,
      wasteTotal,
      orderCount: ordersClosed,
      paymentCount: payments.length,
      checkCount: closedChecks.length,
    };
  }

  async confirm(params: {
    locationId: string;
    businessDate: Date;
    closedById: string;
    notes?: string | null;
  }) {
    const preview = await this.preview(params.locationId, params.businessDate);
    const day = toDateOnly(preview.businessDate);

    const existing = await prisma.dailyClose.findUnique({
      where: {
        locationId_businessDate: {
          locationId: params.locationId,
          businessDate: day,
        },
      },
    });
    if (existing) {
      throw new Error("Ya existe un cierre para esta fecha.");
    }

    return prisma.dailyClose.create({
      data: {
        locationId: params.locationId,
        businessDate: day,
        closedById: params.closedById,
        salesTotal: preview.salesTotal,
        cashExpected: preview.cashExpected,
        cardTotal: preview.cardTotal,
        transferTotal: preview.transferTotal,
        tipsTotal: preview.tipsTotal,
        discountsTotal: preview.discountsTotal,
        cancellationsTotal: preview.cancellationsTotal,
        wasteTotal: preview.wasteTotal,
        orderCount: preview.orderCount,
        notes: params.notes ?? null,
      },
    });
  }
}

export const dailyCloseService = new DailyCloseService();
