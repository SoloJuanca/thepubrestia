/**
 * Money helpers for bill split UX (pure, testable).
 */
import { roundMoney } from "@/services/pricing.service";

export function splitEqualAmounts(total: number, parts: number): number[] {
  if (parts < 2) throw new Error("Se necesitan al menos 2 personas.");
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const amounts = Array.from({ length: parts }, () => base);
  let remainder = cents - base * parts;
  amounts[parts - 1]! += remainder;
  return amounts.map((c) => roundMoney(c / 100));
}

export function assertFullyAssigned(total: number, assigned: number) {
  const diff = roundMoney(total - assigned);
  if (Math.abs(diff) > 0.009) {
    throw new Error(
      `Queda saldo sin asignar: $${Math.abs(diff).toFixed(2)}.`,
    );
  }
}

/** Payments must cover the check total (overpay OK as change). */
export function assertPaymentsCoverTotal(total: number, paid: number) {
  if (roundMoney(paid) + 0.001 < roundMoney(total)) {
    throw new Error(
      `Pagos insuficientes. Total $${roundMoney(total).toFixed(2)}, pagado $${roundMoney(paid).toFixed(2)}.`,
    );
  }
}

/** Table can close only when every non-cancelled check is CLOSED. */
export function assertAllChecksPaid(
  checks: Array<{ status: string }>,
): void {
  const open = checks.filter(
    (c) => c.status !== "CLOSED" && c.status !== "CANCELLED",
  );
  if (open.length > 0) {
    throw new Error(
      `Hay ${open.length} cuenta(s) con saldo pendiente. Cobra todas antes de cerrar la mesa.`,
    );
  }
}

export function displayCheckName(
  name: string,
  checkCount: number,
): string | null {
  if (checkCount <= 1) return null;
  if (name === "General" || name === "Cuenta de Mesa") return "Cuenta";
  return name;
}

export const TABLE_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Libre",
  OCCUPIED: "Ocupada",
  AWAITING_PAYMENT: "Por cobrar",
  RESERVED: "Reservada",
  CLEANING: "Limpieza",
};
