import { differenceInMinutes } from "date-fns";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { TakeoutBoard } from "@/features/pos/components/TakeoutBoard";

export const dynamic = "force-dynamic";

export default async function TakeoutPage() {
  await requirePermission("pos", "read");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal activa.</p>;
  }

  const orders = await prisma.order.findMany({
    where: {
      locationId: location.id,
      tableId: null,
      guestName: { not: null },
      employeeMealOrder: { is: null },
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    orderBy: { openedAt: "desc" },
    include: {
      waiter: true,
      checks: { where: { status: { not: "CANCELLED" } } },
    },
  });

  return (
    <TakeoutBoard
      orders={orders.map((order) => ({
        id: order.id,
        guestName: order.guestName ?? "Para llevar",
        ticketNumber: order.ticketNumber,
        openMinutes: differenceInMinutes(new Date(), order.openedAt),
        total: order.checks
          .reduce((sum, check) => sum + Number(check.total), 0)
          .toFixed(2),
        waiterName: order.waiter?.name ?? order.waiter?.email ?? null,
        unpaidCount: order.checks.filter((check) => check.status === "OPEN")
          .length,
        status: order.status,
      }))}
    />
  );
}
