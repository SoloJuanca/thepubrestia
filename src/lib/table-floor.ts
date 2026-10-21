/** Piso Alena: 8 filas × 4 mitades (10-13 … 80-83). */

export const FLOOR_ROWS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const FLOOR_SEATS = [0, 1, 2, 3] as const;

export const FLOOR_TABLE_CODES: number[] = FLOOR_ROWS.flatMap((row) =>
  FLOOR_SEATS.map((seat) => row * 10 + seat),
);

export type FloorCode = (typeof FLOOR_TABLE_CODES)[number];

export function parseTableCode(name: string): number | null {
  const n = Number.parseInt(name.trim(), 10);
  if (!Number.isFinite(n)) return null;
  if (!FLOOR_TABLE_CODES.includes(n)) return null;
  return n;
}

export function rowOf(code: number): number {
  return Math.floor(code / 10);
}

export function seatOf(code: number): number {
  return code % 10;
}

export function areAdjacent(a: number, b: number): boolean {
  return rowOf(a) === rowOf(b) && Math.abs(seatOf(a) - seatOf(b)) === 1;
}

/**
 * Primary when joining two adjacent mitades:
 * - 10+11 → 11 (mesa 11 se separa en 10 y 11)
 * - 12+13 → 12 (mesa 12 se separa en 12 y 13)
 * - 11+12 → 11 (juntar pasillo)
 */
export function joinPrimaryCode(a: number, b: number): number {
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  if (!areAdjacent(left, right)) {
    throw new Error("Solo se pueden juntar mesas adyacentes de la misma fila.");
  }
  const ls = seatOf(left);
  const rs = seatOf(right);
  if (ls === 0 && rs === 1) return right; // → 11
  if (ls === 2 && rs === 3) return left; // → 12
  if (ls === 1 && rs === 2) return left; // → 11
  return left;
}

export function formatGroupLabel(codes: number[]): string {
  return [...codes].sort((a, b) => a - b).join(" + ");
}

/** Default half-pairs already joined on seed: x0→x1 and x3→x2. */
export function defaultJoinPairs(): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (const row of FLOOR_ROWS) {
    pairs.push([row * 10 + 0, row * 10 + 1]); // 10 → 11
    pairs.push([row * 10 + 3, row * 10 + 2]); // 13 → 12
  }
  return pairs;
}
