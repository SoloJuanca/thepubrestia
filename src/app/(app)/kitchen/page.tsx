import { format } from "date-fns";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { KitchenBoard } from "@/features/pos/components/KitchenBoard";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  await requirePermission("kitchen", "read");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const items = await prisma.orderItem.findMany({
    where: {
      status: { in: ["SENT_TO_KITCHEN", "PREPARING", "READY"] },
      check: {
        order: {
          locationId: location.id,
          status: { notIn: ["CLOSED", "CANCELLED"] },
        },
      },
    },
    include: {
      modifiers: true,
      check: {
        include: {
          order: {
            include: { table: true },
          },
        },
      },
    },
    orderBy: [{ sentToKitchenAt: "asc" }, { createdAt: "asc" }],
  });

  return (
    <KitchenBoard
      tickets={items.map((item) => ({
        orderItemId: item.id,
        tableName: item.check.order.table?.name ?? "Sin mesa",
        checkName: item.check.name,
        itemName: item.nameSnapshot,
        quantity: item.quantity,
        modifiers: item.modifiers.map((m) => m.nameSnapshot),
        notes: item.notes,
        status: item.status,
        sentAt: item.sentToKitchenAt
          ? format(item.sentToKitchenAt, "HH:mm")
          : null,
      }))}
    />
  );
}
