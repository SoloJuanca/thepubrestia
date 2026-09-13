import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { differenceInMinutes } from "date-fns";
import { TablesGrid } from "@/features/pos/components/TablesGrid";

export default async function PosPage() {
  const { user } = await requirePermission("pos", "read");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal activa.</p>;
  }

  const [tables, waiters] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { locationId: location.id, active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        orders: {
          where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
          take: 1,
          orderBy: { openedAt: "desc" },
          include: {
            waiter: true,
            checks: {
              where: { status: { not: "CANCELLED" } },
              include: {
                items: { where: { status: { not: "CANCELLED" } } },
              },
            },
          },
        },
      },
    }),
    prisma.employeeProfile.findMany({
      where: { locationId: location.id, active: true },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const waiterOptions = waiters
    .filter((w) =>
      w.user.roles.some((r) =>
        ["WAITER", "CASHIER", "MANAGER", "ADMIN", "SUPER_ADMIN"].includes(
          r.role.code,
        ),
      ),
    )
    .map((w) => ({
      id: w.userId,
      name: w.user.name ?? w.user.email,
    }));

  if (!waiterOptions.some((w) => w.id === user.id)) {
    waiterOptions.unshift({
      id: user.id,
      name: user.name ?? user.email,
    });
  }

  return (
    <TablesGrid
      currentUserId={user.id}
      waiters={waiterOptions}
      tables={tables.map((table) => {
        const order = table.orders[0] ?? null;
        const total = order
          ? order.checks.reduce((sum, c) => sum + Number(c.total), 0)
          : null;
        const unpaidCount =
          order?.checks.filter((c) => c.status === "OPEN").length ?? 0;
        return {
          id: table.id,
          name: table.name,
          capacity: table.capacity,
          status: table.status,
          openOrderId: order?.id ?? null,
          openMinutes: order
            ? differenceInMinutes(new Date(), order.openedAt)
            : null,
          checkTotal: total != null ? total.toFixed(2) : null,
          waiterName: order?.waiter?.name ?? order?.waiter?.email ?? null,
          partySize: order?.partySize ?? null,
          checkCount: order?.checks.length ?? 0,
          unpaidCount,
        };
      })}
    />
  );
}
