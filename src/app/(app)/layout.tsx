import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NAV_ITEMS, hasPermission } from "@/lib/permissions";
import { flattenPermissions, requireUser } from "@/lib/rbac";
import { resolveRolePersona } from "@/lib/role-home";
import { splitNavByPersona } from "@/lib/nav-split";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permissions = flattenPermissions(user);
  const roles = user.roles.map((r) => r.role.code);
  const persona = resolveRolePersona(roles);

  const navItems = NAV_ITEMS.filter((item) => {
    if (item.href === "/inventory") {
      return (
        hasPermission(permissions, "inventory", "read") ||
        hasPermission(permissions, "recipes", "read")
      );
    }
    return hasPermission(permissions, item.resource, item.action ?? "read");
  });

  const { primary, more } = splitNavByPersona(navItems, persona);

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar primaryItems={primary} moreItems={more} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          userName={user.name}
          userEmail={user.email}
          roles={roles}
          primaryItems={primary}
          moreItems={more}
        />
        <main className="flex-1 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
