import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { OrdersList } from "@/features/pos/components/OrdersList";

export default async function OrdersPage() {
  await requirePermission("orders", "read");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const orders = await prisma.order.findMany({
    where: {
      locationId: location.id,
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    include: {
      table: true,
      waiter: true,
      checks: {
        where: { status: { not: "CANCELLED" } },
      },
    },
    orderBy: { openedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Órdenes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Órdenes abiertas de la sucursal
        </p>
      </div>
      <OrdersList
        orders={orders.map((order) => ({
          id: order.id,
          ticketNumber: order.ticketNumber,
          tableName: order.table?.name ?? null,
          tableId: order.tableId,
          status: order.status,
          waiterName: order.waiter?.name ?? order.waiter?.email ?? null,
          openedAt: order.openedAt,
          total: order.checks
            .reduce((sum, c) => sum + Number(c.total), 0)
            .toFixed(2),
          checkCount: order.checks.length,
        }))}
      />
    </div>
  );
}
