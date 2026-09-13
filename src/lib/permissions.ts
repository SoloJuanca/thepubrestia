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
  | "daily_close";

export type NavItem = {
  title: string;
  href: string;
  resource: PermissionResource;
  action?: PermissionAction;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", resource: "dashboard" },
  { title: "POS / Mesas", href: "/pos", resource: "pos" },
  { title: "Órdenes", href: "/orders", resource: "orders" },
  { title: "Cocina", href: "/kitchen", resource: "kitchen" },
  { title: "Menú", href: "/menu", resource: "menu" },
  { title: "Inventario", href: "/inventory", resource: "inventory" },
  { title: "Compras", href: "/purchases", resource: "purchases" },
  { title: "Proveedores", href: "/suppliers", resource: "suppliers" },
  { title: "Clientes", href: "/customers", resource: "customers" },
  { title: "Promociones", href: "/promotions", resource: "promotions" },
  { title: "Reseñas", href: "/reviews", resource: "reviews" },
  { title: "Empleados", href: "/employees", resource: "employees" },
  { title: "Finanzas", href: "/finance", resource: "finance" },
  { title: "Reportes", href: "/reports", resource: "reports" },
  { title: "Configuración", href: "/settings", resource: "settings" },
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
      ];
    case "KITCHEN":
      return [
        { resource: "kitchen", action: "read" },
        { resource: "kitchen", action: "update" },
        { resource: "orders", action: "read" },
        { resource: "orders", action: "update" },
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
