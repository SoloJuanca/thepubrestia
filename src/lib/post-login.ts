import { isKitchenRole } from "@/lib/permissions";

/** Roles that should land on the general ops dashboard after login. */
const DASHBOARD_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "WAITER",
  "CASHIER",
  "INVENTORY",
] as const;

export function homePathForRoles(roles: string[] | undefined | null): string {
  const list = roles ?? [];
  const hasOps = list.some((r) =>
    (DASHBOARD_ROLES as readonly string[]).includes(r),
  );
  if (isKitchenRole(list) && !hasOps) return "/kitchen";
  return "/dashboard";
}
