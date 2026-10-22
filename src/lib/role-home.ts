import { isKitchenRole } from "@/lib/permissions";

export type RolePersona =
  | "waiter"
  | "cashier"
  | "kitchen"
  | "inventory"
  | "manager"
  | "admin";

const OPS_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "WAITER",
  "CASHIER",
  "INVENTORY",
] as const;

export function resolveRolePersona(roles: string[]): RolePersona {
  const list = roles ?? [];
  if (list.includes("SUPER_ADMIN") || list.includes("ADMIN")) return "admin";
  if (list.includes("MANAGER")) return "manager";

  const kitchenOnly =
    isKitchenRole(list) &&
    !list.some((r) => (OPS_ROLES as readonly string[]).includes(r));
  if (kitchenOnly) return "kitchen";

  if (list.includes("INVENTORY")) return "inventory";
  if (list.includes("CASHIER") && !list.includes("WAITER")) return "cashier";
  if (list.includes("WAITER")) return "waiter";
  if (list.includes("CASHIER")) return "cashier";
  if (isKitchenRole(list)) return "kitchen";
  return "manager";
}

export type HubPath = {
  title: string;
  description: string;
  href: string;
  /** Permission resource required (read) — skipped if empty */
  resource?: string;
};

const HUB_PATHS: Record<RolePersona, HubPath[]> = {
  waiter: [
    {
      title: "Atender mesas",
      description: "Abrir mesa, tomar pedido y enviar a cocina",
      href: "/pos",
      resource: "pos",
    },
    {
      title: "Para llevar",
      description: "Pedido por nombre, sin mesa",
      href: "/takeout",
      resource: "pos",
    },
    {
      title: "Órdenes activas",
      description: "Ver qué ya se envió a cocina",
      href: "/orders",
      resource: "orders",
    },
    {
      title: "Asistencia",
      description: "Check-in / check-out del turno",
      href: "/attendance",
      resource: "attendance",
    },
  ],
  cashier: [
    {
      title: "Cobrar",
      description: "Mesas con cuenta abierta o por cobrar",
      href: "/pos",
      resource: "pos",
    },
    {
      title: "Para llevar",
      description: "Pedidos por nombre listos para cobrar",
      href: "/takeout",
      resource: "pos",
    },
    {
      title: "Cerrar el día",
      description: "Preview y cierre inmutable",
      href: "/daily-close",
      resource: "daily_close",
    },
    {
      title: "Registrar gasto",
      description: "Gastos del turno",
      href: "/expenses",
      resource: "expenses",
    },
    {
      title: "Asistencia",
      description: "Check-in / check-out",
      href: "/attendance",
      resource: "attendance",
    },
  ],
  kitchen: [
    {
      title: "Cola de cocina",
      description: "Enviado → preparando → listo",
      href: "/kitchen",
      resource: "kitchen",
    },
    {
      title: "Consultar recetas",
      description: "Insumos por platillo",
      href: "/inventory?tab=recipes",
      resource: "recipes",
    },
    {
      title: "Producción",
      description: "Preparar PREPs del día",
      href: "/inventory?tab=production",
      resource: "inventory",
    },
    {
      title: "Asistencia",
      description: "Marcar entrada con QR o lista",
      href: "/attendance",
      resource: "attendance",
    },
  ],
  inventory: [
    {
      title: "Registrar entrada",
      description: "Recibir producto y subir existencias",
      href: "/inventory?tab=ops&focus=entrada",
      resource: "inventory",
    },
    {
      title: "Registrar merma",
      description: "Baja por daño, caducidad u error",
      href: "/inventory?tab=ops&focus=waste",
      resource: "inventory",
    },
    {
      title: "Alertas de stock",
      description: "Bajos y agotados",
      href: "/inventory",
      resource: "inventory",
    },
    {
      title: "Pedidos a proveedor",
      description: "Crear o recibir órdenes de compra",
      href: "/purchases",
      resource: "purchases",
    },
    {
      title: "Producción PREP",
      description: "Batches de preparados",
      href: "/inventory?tab=production",
      resource: "inventory",
    },
  ],
  manager: [
    {
      title: "Mesas",
      description: "Operación en piso",
      href: "/pos",
      resource: "pos",
    },
    {
      title: "Cocina",
      description: "Cola de preparación",
      href: "/kitchen",
      resource: "kitchen",
    },
    {
      title: "Inventario",
      description: "Stock, entradas y alertas",
      href: "/inventory",
      resource: "inventory",
    },
    {
      title: "Pedidos a proveedor",
      description: "Abastecimiento del día",
      href: "/purchases",
      resource: "purchases",
    },
  ],
  admin: [
    {
      title: "Mesas",
      description: "Operación en piso",
      href: "/pos",
      resource: "pos",
    },
    {
      title: "Cocina",
      description: "Cola de preparación",
      href: "/kitchen",
      resource: "kitchen",
    },
    {
      title: "Inventario",
      description: "Stock y catálogo",
      href: "/inventory",
      resource: "inventory",
    },
    {
      title: "Pedidos a proveedor",
      description: "Compras y recepción",
      href: "/purchases",
      resource: "purchases",
    },
    {
      title: "Finanzas",
      description: "Márgenes, gastos y nómina",
      href: "/finance",
      resource: "finance",
    },
  ],
};

export function hubPathsForPersona(persona: RolePersona): HubPath[] {
  return HUB_PATHS[persona];
}

export const PERSONA_LABELS: Record<RolePersona, string> = {
  waiter: "Mesero",
  cashier: "Caja",
  kitchen: "Cocina",
  inventory: "Inventario",
  manager: "Gerencia",
  admin: "Administración",
};

/** Primary sidebar hrefs (pathname or path without query) per persona. */
export const PRIMARY_NAV_HREFS: Record<RolePersona, string[]> = {
  waiter: ["/dashboard", "/pos", "/takeout", "/orders", "/attendance"],
  cashier: [
    "/dashboard",
    "/pos",
    "/takeout",
    "/daily-close",
    "/expenses",
    "/attendance",
  ],
  kitchen: [
    "/kitchen",
    "/orders",
    "/inventory",
    "/attendance",
    "/attendance/station",
  ],
  inventory: [
    "/dashboard",
    "/inventory",
    "/purchases",
    "/suppliers",
    "/attendance",
  ],
  manager: [
    "/dashboard",
    "/pos",
    "/takeout",
    "/kitchen",
    "/inventory",
    "/purchases",
    "/employees",
  ],
  admin: [
    "/dashboard",
    "/pos",
    "/takeout",
    "/kitchen",
    "/inventory",
    "/purchases",
    "/employees",
    "/finance",
    "/reports",
  ],
};

export function navPathKey(href: string): string {
  return href.split("?")[0] ?? href;
}
