import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/services/pricing.service";

function toNum(v: Prisma.Decimal | number | string) {
  return Number(v);
}

export class FinancialService {
  async periodReport(locationId: string, from: Date, to: Date) {
    const end = to;

    const [closedChecks, saleMovements, wasteMovements, expenses, payroll, ingredients] =
      await Promise.all([
        prisma.check.findMany({
          where: {
            status: "CLOSED",
            closedAt: { gte: from, lt: end },
            order: { locationId },
          },
        }),
        prisma.inventoryMovement.findMany({
          where: {
            locationId,
            movementType: "SALE_CONSUMPTION",
            createdAt: { gte: from, lt: end },
          },
          include: { ingredient: true },
        }),
        prisma.inventoryMovement.findMany({
          where: {
            locationId,
            movementType: "WASTE",
            createdAt: { gte: from, lt: end },
          },
          include: { ingredient: true },
        }),
        prisma.expense.findMany({
          where: {
            locationId,
            expenseDate: { gte: from, lt: end },
          },
        }),
        prisma.payrollEntry.findMany({
          where: {
            locationId,
            status: { in: ["APPROVED", "PAID"] },
            periodStart: { lt: end },
            periodEnd: { gte: from },
          },
        }),
        prisma.ingredient.findMany({
          where: { locationId, active: true },
        }),
      ]);

    const salesTotal = roundMoney(
      closedChecks.reduce((s, c) => s + toNum(c.total), 0),
    );
    const discountsTotal = roundMoney(
      closedChecks.reduce((s, c) => s + toNum(c.discountTotal), 0),
    );
    const tipsTotal = roundMoney(
      closedChecks.reduce((s, c) => s + toNum(c.tipTotal), 0),
    );

    // COGS: abs(qty) * unitCost on movement when present, else ingredient avgCost
    const cogs = roundMoney(
      saleMovements.reduce((s, m) => {
        const qty = Math.abs(toNum(m.quantity));
        const cost =
          m.unitCost != null ? toNum(m.unitCost) : toNum(m.ingredient.averageCost);
        return s + qty * cost;
      }, 0),
    );

    const wasteTotal = roundMoney(
      wasteMovements.reduce((s, m) => {
        const qty = Math.abs(toNum(m.quantity));
        const cost =
          m.unitCost != null ? toNum(m.unitCost) : toNum(m.ingredient.averageCost);
        return s + qty * cost;
      }, 0),
    );

    const expensesTotal = roundMoney(
      expenses.reduce((s, e) => s + toNum(e.amount), 0),
    );
    const payrollTotal = roundMoney(
      payroll.reduce((s, p) => s + toNum(p.totalCost), 0),
    );

    const grossMargin = roundMoney(salesTotal - cogs);
    const operatingMargin = roundMoney(
      grossMargin - expensesTotal - payrollTotal - wasteTotal,
    );

    const inventoryValue = roundMoney(
      ingredients.reduce(
        (s, i) => s + toNum(i.currentStock) * toNum(i.averageCost),
        0,
      ),
    );

    const expensesByCategory = new Map<string, number>();
    for (const e of expenses) {
      expensesByCategory.set(
        e.category,
        roundMoney((expensesByCategory.get(e.category) ?? 0) + toNum(e.amount)),
      );
    }

    return {
      from,
      to: end,
      salesTotal,
      discountsTotal,
      tipsTotal,
      checkCount: closedChecks.length,
      cogs,
      wasteTotal,
      expensesTotal,
      payrollTotal,
      grossMargin,
      operatingMargin,
      inventoryValue,
      expensesByCategory: [...expensesByCategory.entries()].map(
        ([category, amount]) => ({ category, amount }),
      ),
    };
  }
}

export const financialService = new FinancialService();
