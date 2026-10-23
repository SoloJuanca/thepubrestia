export const UNIT_LABELS: Record<string, string> = {
  KG: "kilos",
  G: "gramos",
  L: "litros",
  ML: "mililitros",
  UNIT: "piezas",
  BOX: "cajas",
  PACK: "paquetes",
};

/** Unidades con las que se cuenta el stock en el día a día. */
export const COUNT_UNITS = ["UNIT", "KG", "L"] as const;

export function unitChoices(current?: string | null) {
  const choices: string[] = [...COUNT_UNITS];
  if (current && !choices.includes(current)) choices.push(current);
  return choices;
}

export const WASTE_REASON_LABELS: Record<string, string> = {
  DAMAGED: "Producto dañado",
  EXPIRED: "Caducado",
  KITCHEN_ERROR: "Error de cocina",
  COMP: "Cortesía",
  INTERNAL: "Consumo interno",
  OTHER: "Otro",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  SALE_CONSUMPTION: "Venta / consumo",
  WASTE: "Merma",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolución",
  TRANSFER: "Transferencia",
  PRODUCTION_IN: "Producción (entrada)",
  PRODUCTION_OUT: "Producción (consumo)",
};

export const INGREDIENT_KIND_LABELS: Record<string, string> = {
  RAW: "Insumo",
  PREP: "Preparado",
  FROZEN: "Insumo",
  PACKAGED: "Insumo",
};

export const KIND_OPTIONS = ["RAW", "PREP", "FROZEN", "PACKAGED"] as const;

export const UNIT_OPTIONS = [
  "KG",
  "G",
  "L",
  "ML",
  "UNIT",
  "BOX",
  "PACK",
] as const;
