import { RoleCode } from "@prisma/client";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "close"
  | "adjust"
  | "apply";

export type PermissionResource =
  | "dashboard"
  | "pos"
  | "orders"
  | "menu"
  | "inventory"
  | "purchases"
  | "suppliers"
  | "customers"
  | "promotions"
  | "reviews"
  | "employees"
  | "finance"
  | "reports"
  | "settings"
  | "kitchen"
  | "payroll"
  | "expenses"
  | "checks"
  | "payments"
  | "daily_close"
  | "attendance"
  | "services";

export type NavItem = {
  title: string;
  href: string;
  resource: PermissionResource;
  action?: PermissionAction;
  group: string;
};

export const NAV_GROUPS = [
  "OPERACIÓN",
  "CATÁLOGO",
  "ABASTECIMIENTO",
  "CLIENTES",
  "EQUIPO",
  "ADMINISTRACIÓN",
  "CONFIGURACIÓN",
] as const;

export const NAV_ITEMS: NavItem[] = [
  { title: "Inicio", href: "/dashboard", resource: "dashboard", group: "OPERACIÓN" },
  { title: "POS / Mesas", href: "/pos", resource: "pos", group: "OPERACIÓN" },
  { title: "Órdenes", href: "/orders", resource: "orders", group: "OPERACIÓN" },
  { title: "Cocina", href: "/kitchen", resource: "kitchen", group: "OPERACIÓN" },
  {
    title: "Cierre del día",
    href: "/daily-close",
    resource: "daily_close",
    group: "OPERACIÓN",
  },
  { title: "Menú", href: "/menu", resource: "menu", group: "CATÁLOGO" },
  {
    title: "Inventario",
    href: "/inventory",
    resource: "inventory",
    group: "CATÁLOGO",
  },
  {
    title: "Pedidos",
    href: "/purchases",
    resource: "purchases",
    group: "ABASTECIMIENTO",
  },
  {
    title: "Proveedores",
    href: "/suppliers",
    resource: "suppliers",
    group: "ABASTECIMIENTO",
  },
  {
    title: "Clientes",
    href: "/customers",
    resource: "customers",
    group: "CLIENTES",
  },
  {
    title: "Promociones",
    href: "/promotions",
    resource: "promotions",
    group: "CLIENTES",
  },
  { title: "Reseñas", href: "/reviews", resource: "reviews", group: "CLIENTES" },
  {
    title: "Empleados",
    href: "/employees",
    resource: "employees",
    group: "EQUIPO",
  },
  {
    title: "Asistencia",
    href: "/attendance",
    resource: "attendance",
    group: "EQUIPO",
  },
  {
    title: "Servicios y mantenimiento",
    href: "/services",
    resource: "services",
    group: "ADMINISTRACIÓN",
  },
  {
    title: "Gastos",
    href: "/expenses",
    resource: "expenses",
    group: "ADMINISTRACIÓN",
  },
  {
    title: "Finanzas",
    href: "/finance",
    resource: "finance",
    group: "ADMINISTRACIÓN",
  },
  {
    title: "Reportes",
    href: "/reports",
    resource: "reports",
    group: "ADMINISTRACIÓN",
  },
  {
    title: "Configuración",
    href: "/settings",
    resource: "settings",
    group: "CONFIGURACIÓN",
  },
];

const ALL_RESOURCES: PermissionResource[] = [
  "dashboard",
  "pos",
  "orders",
  "menu",
  "inventory",
  "purchases",
  "suppliers",
  "customers",
  "promotions",
  "reviews",
  "employees",
  "finance",
  "reports",
  "settings",
  "kitchen",
  "payroll",
  "expenses",
  "checks",
  "payments",
  "daily_close",
  "attendance",
  "services",
];

const ALL_ACTIONS: PermissionAction[] = [
  "read",
  "create",
  "update",
  "delete",
  "close",
  "adjust",
  "apply",
];

export function allPermissionPairs(): Array<{
  resource: PermissionResource;
  action: PermissionAction;
}> {
  return ALL_RESOURCES.flatMap((resource) =>
    ALL_ACTIONS.map((action) => ({ resource, action })),
  );
}

export function permissionsForRole(
  role: RoleCode,
): Array<{ resource: PermissionResource; action: PermissionAction }> {
  switch (role) {
    case "SUPER_ADMIN":
      return allPermissionPairs();
    case "ADMIN":
      return allPermissionPairs().filter(
        (p) => !(p.resource === "settings" && p.action === "delete"),
      );
    case "MANAGER":
      return allPermissionPairs().filter(
        (p) => !["settings", "finance", "payroll"].includes(p.resource),
      );
    case "WAITER":
      return [
        { resource: "dashboard", action: "read" },
        { resource: "pos", action: "read" },
        { resource: "pos", action: "create" },
        { resource: "pos", action: "update" },
        { resource: "orders", action: "read" },
        { resource: "orders", action: "create" },
        { resource: "orders", action: "update" },
        { resource: "customers", action: "read" },
        { resource: "customers", action: "create" },
        { resource: "promotions", action: "read" },
        { resource: "promotions", action: "apply" },
        { resource: "reviews", action: "read" },
        { resource: "reviews", action: "create" },
        { resource: "checks", action: "read" },
        { resource: "checks", action: "update" },
        { resource: "checks", action: "close" },
        { resource: "payments", action: "create" },
        { resource: "payments", action: "read" },
        { resource: "attendance", action: "read" },
        { resource: "attendance", action: "create" },
        { resource: "attendance", action: "update" },
      ];
    case "CASHIER":
      return [
        { resource: "dashboard", action: "read" },
        { resource: "pos", action: "read" },
        { resource: "orders", action: "read" },
        { resource: "checks", action: "read" },
        { resource: "checks", action: "close" },
        { resource: "payments", action: "create" },
        { resource: "payments", action: "read" },
        { resource: "daily_close", action: "create" },
        { resource: "daily_close", action: "read" },
        { resource: "promotions", action: "read" },
        { resource: "promotions", action: "apply" },
        { resource: "customers", action: "read" },
        { resource: "attendance", action: "read" },
        { resource: "attendance", action: "create" },
        { resource: "attendance", action: "update" },
        { resource: "expenses", action: "read" },
      ];
    case "KITCHEN":
      return [
        { resource: "kitchen", action: "read" },
        { resource: "kitchen", action: "update" },
        { resource: "orders", action: "read" },
        { resource: "orders", action: "update" },
        { resource: "attendance", action: "read" },
        { resource: "attendance", action: "create" },
        { resource: "attendance", action: "update" },
      ];
    case "INVENTORY":
      return [
        { resource: "dashboard", action: "read" },
        { resource: "inventory", action: "read" },
        { resource: "inventory", action: "create" },
        { resource: "inventory", action: "update" },
        { resource: "inventory", action: "adjust" },
        { resource: "purchases", action: "read" },
        { resource: "purchases", action: "create" },
        { resource: "purchases", action: "update" },
        { resource: "suppliers", action: "read" },
        { resource: "suppliers", action: "create" },
        { resource: "suppliers", action: "update" },
        { resource: "attendance", action: "read" },
        { resource: "attendance", action: "create" },
        { resource: "attendance", action: "update" },
      ];
    default:
      return [];
  }
}

export function hasPermission(
  userPermissions: Array<{ resource: string; action: string }>,
  resource: PermissionResource,
  action: PermissionAction = "read",
): boolean {
  return userPermissions.some(
    (p) => p.resource === resource && p.action === action,
  );
}
