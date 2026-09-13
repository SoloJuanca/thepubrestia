/**
 * Central pricing — single source for POS, tickets, and reports.
 */
export type PriceInput = {
  basePrice: number;
  modifiersTotal?: number;
  discountAmount?: number;
  taxRate?: number;
};

export type PriceBreakdown = {
  basePrice: number;
  modifiersTotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  finalPrice: number;
};

export type CheckLineForTotals = {
  quantity: number;
  unitPrice: number;
  modifiersTotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
};

export type CheckTotals = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
};

export function calculateLinePrice(input: PriceInput): PriceBreakdown {
  const basePrice = input.basePrice;
  const modifiersTotal = input.modifiersTotal ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const taxRate = input.taxRate ?? 0;

  const taxableAmount = Math.max(
    0,
    basePrice + modifiersTotal - discountAmount,
  );
  const taxAmount = roundMoney(taxableAmount * taxRate);
  const finalPrice = roundMoney(taxableAmount + taxAmount);

  return {
    basePrice,
    modifiersTotal,
    discountAmount,
    taxableAmount: roundMoney(taxableAmount),
    taxAmount,
    finalPrice,
  };
}

/** Build line amounts for `quantity` units (modifiers/discount are per unit). */
export function calculateOrderItemAmounts(input: {
  basePrice: number;
  modifiersTotal: number;
  discountAmount?: number;
  taxRate: number;
  quantity: number;
}) {
  const unit = calculateLinePrice({
    basePrice: input.basePrice,
    modifiersTotal: input.modifiersTotal,
    discountAmount: input.discountAmount ?? 0,
    taxRate: input.taxRate,
  });
  const qty = Math.max(1, input.quantity);
  return {
    unitPrice: unit.basePrice,
    modifiersTotal: unit.modifiersTotal,
    discountAmount: roundMoney(unit.discountAmount * qty),
    taxAmount: roundMoney(unit.taxAmount * qty),
    lineTotal: roundMoney(unit.finalPrice * qty),
  };
}

export function calculateCheckTotals(lines: CheckLineForTotals[]): CheckTotals {
  const subtotal = roundMoney(
    lines.reduce(
      (sum, line) =>
        sum +
        (line.unitPrice + line.modifiersTotal) * line.quantity -
        line.discountAmount,
      0,
    ),
  );
  const discountTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.discountAmount, 0),
  );
  const taxTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.taxAmount, 0),
  );
  const total = roundMoney(
    lines.reduce((sum, line) => sum + line.lineTotal, 0),
  );
  return { subtotal, discountTotal, taxTotal, total };
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}
