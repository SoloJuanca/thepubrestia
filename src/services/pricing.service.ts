/**
 * Central pricing rules — Phase 1 stub.
 * All POS / ticket / dashboard price math must call this service in later phases.
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

export function calculateLinePrice(input: PriceInput): PriceBreakdown {
  const basePrice = input.basePrice;
  const modifiersTotal = input.modifiersTotal ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const taxRate = input.taxRate ?? 0;

  const taxableAmount = Math.max(0, basePrice + modifiersTotal - discountAmount);
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

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}
