export const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  G: "g",
  L: "L",
  ML: "ml",
  UNIT: "unidad",
  BOX: "caja",
  PACK: "paquete",
};

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
};

export const UNIT_OPTIONS = [
  "KG",
  "G",
  "L",
  "ML",
  "UNIT",
  "BOX",
  "PACK",
] as const;
