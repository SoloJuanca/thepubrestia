export const PREP_MAX_DAYS = 3;
export const PERISHABLE_MAX_DAYS = 5;

const PERISHABLE_PATTERN =
  /(verdura|lechuga|jitomate|tomate|cebolla|cilantro|perejil|chile|pimiento|zanahoria|pepino|aguacate|apio|espinaca|brocoli|elote|ajo|limon|naranja|fruta|manzana|pina|fresa|platano|mango|melon|sandia|carne|pollo|puerco|cerdo|pescado|camaron|marisco|jamon|tocino|chorizo|arrachera|pechuga|milanesa|atun|salmon|huevo|lomo|bistec|costilla|queso)/;

const NOT_PERISHABLE_PATTERN =
  /(jugo|boing|jumex|mermelada|sobre|refresco|joya|aceite|catsup|ketchup|mayonesa|aderezo|lechera|condensad|crema de coco|enlat|almibar|sierra|coca|pepsi|agua )/;

export function isPrepared(kind: string) {
  return kind === "PREP";
}

export function stockGroupLabel(kind: string) {
  return isPrepared(kind) ? "Preparado" : "Insumo";
}

export function looksPerishable(name: string, category?: string | null) {
  const text = `${name} ${category ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (NOT_PERISHABLE_PATTERN.test(text)) return false;
  return PERISHABLE_PATTERN.test(text);
}

export function daysOnHand(
  stockedAt: Date | string | null | undefined,
  now = new Date(),
) {
  if (!stockedAt) return null;
  const start = new Date(stockedAt);
  if (Number.isNaN(start.getTime())) return null;
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

/** More than `limitDays` full days with stock still on hand. */
export function isOlderThan(
  stockedAt: Date | string | null | undefined,
  limitDays: number,
  now = new Date(),
) {
  if (!stockedAt) return false;
  const start = new Date(stockedAt);
  if (Number.isNaN(start.getTime())) return false;
  return now.getTime() - start.getTime() > limitDays * 86_400_000;
}

export function formatQty(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 3,
  }).format(n);
}
