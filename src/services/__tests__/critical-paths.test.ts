import { describe, expect, it } from "vitest";
import {
  calculateCheckTotals,
  calculateLinePrice,
  roundMoney,
} from "@/services/pricing.service";
import { isPromotionInWindow } from "@/services/promotion.service";
import { hasPermission, permissionsForRole } from "@/lib/permissions";
import { computeNextServiceDate } from "@/services/service.service";
import {
  assertReceiveQty,
  stockAfterReceive,
} from "@/services/purchase-order.service";
import {
  assertAllChecksPaid,
  assertFullyAssigned,
  assertPaymentsCoverTotal,
  splitEqualAmounts,
} from "@/lib/pos-labels";
import {
  resolveCheckInStatus,
  resolveCheckOutStatus,
} from "@/services/attendance.service";
import { inventoryService } from "@/services/inventory.service";

describe("pricing", () => {
  it("rounds money to 2 decimals", () => {
    expect(roundMoney(10.006)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });

  it("calculates line price with tax and discount", () => {
    const line = calculateLinePrice({
      basePrice: 100,
      modifiersTotal: 20,
      discountAmount: 10,
      taxRate: 0.16,
    });
    expect(line.taxableAmount).toBe(110);
    expect(line.taxAmount).toBe(17.6);
    expect(line.finalPrice).toBe(127.6);
  });

  it("preserves totals when summing lines", () => {
    const totals = calculateCheckTotals([
      {
        quantity: 2,
        unitPrice: 50,
        modifiersTotal: 0,
        discountAmount: 10,
        taxAmount: 14.4,
        lineTotal: 104.4,
      },
      {
        quantity: 1,
        unitPrice: 30,
        modifiersTotal: 5,
        discountAmount: 0,
        taxAmount: 5.6,
        lineTotal: 40.6,
      },
    ]);
    expect(totals.discountTotal).toBe(10);
    expect(totals.taxTotal).toBe(20);
    expect(totals.total).toBe(145);
  });
});

describe("bill split", () => {
  it("splits equally and assigns leftover cents to last person", () => {
    const parts = splitEqualAmounts(10, 3);
    expect(parts).toHaveLength(3);
    expect(roundMoney(parts.reduce((s, n) => s + n, 0))).toBe(10);
    expect(parts[2]).toBe(3.34);
  });

  it("rejects incomplete assignment", () => {
    expect(() => assertFullyAssigned(100, 99.5)).toThrow(/sin asignar/i);
    expect(() => assertFullyAssigned(100, 100)).not.toThrow();
  });

  it("rejects underpayment but allows exact/overpay", () => {
    expect(() => assertPaymentsCoverTotal(100, 99.99)).toThrow(/insuficientes/i);
    expect(() => assertPaymentsCoverTotal(100, 100)).not.toThrow();
    expect(() => assertPaymentsCoverTotal(100, 120)).not.toThrow();
  });

  it("blocks closing table with open checks", () => {
    expect(() =>
      assertAllChecksPaid([{ status: "OPEN" }, { status: "CLOSED" }]),
    ).toThrow(/saldo pendiente/i);
    expect(() =>
      assertAllChecksPaid([{ status: "CLOSED" }, { status: "CANCELLED" }]),
    ).not.toThrow();
  });
});

describe("promotion window", () => {
  it("rejects inactive / expired promos", () => {
    const now = new Date("2026-06-01");
    expect(
      isPromotionInWindow(
        {
          active: false,
          startsAt: new Date("2020-01-01"),
          endsAt: null,
        },
        now,
      ).ok,
    ).toBe(false);
    expect(
      isPromotionInWindow(
        {
          active: true,
          startsAt: new Date("2020-01-01"),
          endsAt: new Date("2030-01-01"),
        },
        now,
      ).ok,
    ).toBe(true);
  });
});

describe("RBAC", () => {
  it("WAITER cannot access finance", () => {
    const waiter = permissionsForRole("WAITER");
    expect(hasPermission(waiter, "finance", "read")).toBe(false);
  });

  it("WAITER can close checks and use attendance", () => {
    const waiter = permissionsForRole("WAITER");
    expect(hasPermission(waiter, "checks", "close")).toBe(true);
    expect(hasPermission(waiter, "attendance", "create")).toBe(true);
  });

  it("ADMIN can access finance and services", () => {
    const admin = permissionsForRole("ADMIN");
    expect(hasPermission(admin, "finance", "read")).toBe(true);
    expect(hasPermission(admin, "services", "read")).toBe(true);
  });

  it("KITCHEN cannot access employees module", () => {
    const kitchen = permissionsForRole("KITCHEN");
    expect(hasPermission(kitchen, "employees", "read")).toBe(false);
  });
});

describe("service recurrence", () => {
  it("computes next monthly date", () => {
    const from = new Date(2026, 6, 10);
    const next = computeNextServiceDate(from, "MONTHLY", 3);
    expect(next.getMonth()).toBe(9);
    expect(next.getDate()).toBe(10);
  });
});

describe("attendance status helpers", () => {
  it("marks late check-in past grace", () => {
    const checkInAt = new Date(2026, 8, 14, 10, 25, 0);
    expect(
      resolveCheckInStatus({
        checkInAt,
        startTime: "10:00",
        isDayOff: false,
        graceMinutes: 10,
      }),
    ).toBe("LATE");
    expect(
      resolveCheckInStatus({
        checkInAt: new Date(2026, 8, 14, 10, 5, 0),
        startTime: "10:00",
        isDayOff: false,
      }),
    ).toBe("ON_TIME");
  });

  it("marks early leave on checkout", () => {
    expect(
      resolveCheckOutStatus({
        checkInStatus: "ON_TIME",
        checkOutAt: new Date(2026, 8, 14, 16, 0, 0),
        endTime: "18:00",
        isDayOff: false,
      }),
    ).toBe("EARLY_LEAVE");
  });

  it("blocks duplicate open shift message contract", () => {
    const message =
      "Ya tienes una asistencia abierta. Registra la salida primero.";
    expect(message).toMatch(/asistencia abierta/i);
  });
});

describe("purchase receive", () => {
  it("rejects over-receive and computes stock delta", () => {
    expect(() =>
      assertReceiveQty({
        ordered: 10,
        alreadyReceived: 8,
        incoming: 3,
        ingredientName: "Malta",
      }),
    ).toThrow(/excesiva/i);
    expect(() =>
      assertReceiveQty({
        ordered: 10,
        alreadyReceived: 8,
        incoming: 2,
      }),
    ).not.toThrow();
    expect(stockAfterReceive(5, 2)).toBe(7);
  });

  it("allows partial receive then remaining", () => {
    expect(() =>
      assertReceiveQty({
        ordered: 16,
        alreadyReceived: 0,
        incoming: 10,
      }),
    ).not.toThrow();
    expect(() =>
      assertReceiveQty({
        ordered: 16,
        alreadyReceived: 10,
        incoming: 6,
      }),
    ).not.toThrow();
    expect(stockAfterReceive(4, 10)).toBe(14);
  });
});

describe("service to expense", () => {
  it("advances next date after completing a service cycle", () => {
    const performed = new Date(2026, 0, 15);
    const next = computeNextServiceDate(performed, "MONTHLY", 1);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(15);
  });
});

describe("stock suggestion", () => {
  it("suggests purchase to reach ideal stock level", () => {
    expect(inventoryService.suggestedPurchase(4, 8, 20)).toBe(16);
    // Above minimum but below ideal still suggests top-up to ideal
    expect(inventoryService.suggestedPurchase(10, 8, 20)).toBe(10);
    expect(inventoryService.suggestedPurchase(20, 8, 20)).toBe(0);
  });
});
