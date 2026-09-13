import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NAV_ITEMS, hasPermission } from "@/lib/permissions";
import { flattenPermissions, requireUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permissions = flattenPermissions(user);

  const navItems = NAV_ITEMS.filter((item) =>
    hasPermission(permissions, item.resource, item.action ?? "read"),
  );

  const roles = user.roles.map((r) => r.role.code);

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar items={navItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          title="Panel operativo"
          userName={user.name}
          userEmail={user.email}
          roles={roles}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
