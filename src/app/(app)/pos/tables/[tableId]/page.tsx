import { notFound } from "next/navigation";
import { differenceInMinutes } from "date-fns";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { orderService } from "@/services/order.service";
import { TableSessionView } from "@/features/pos/components/TableSessionView";

type Props = { params: Promise<{ tableId: string }> };

const orderInclude = {
  waiter: true,
  seats: { orderBy: { sortOrder: "asc" as const } },
  checks: {
    where: { status: { not: "CANCELLED" as const } },
    orderBy: { createdAt: "asc" as const },
    include: {
      promotion: true,
      items: {
        where: { status: { not: "CANCELLED" as const } },
        orderBy: { createdAt: "asc" as const },
        include: { modifiers: true },
      },
    },
  },
};

export default async function PosTablePage({ params }: Props) {
  const { user } = await requirePermission("pos", "read");
  const { tableId } = await params;

  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
  });
  if (!table || !table.active) notFound();

  let order = await prisma.order.findFirst({
    where: {
      tableId,
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    include: orderInclude,
  });

  if (!order) {
    await requirePermission("pos", "create");
    const created = await orderService.openTable({
      locationId: table.locationId,
      tableId: table.id,
      waiterId: user.id,
      partySize: table.capacity,
    });
    order = await prisma.order.findUniqueOrThrow({
      where: { id: created.id },
      include: orderInclude,
    });
  }

  const [categories, menuItems] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { locationId: table.locationId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.menuItem.findMany({
      where: {
        locationId: table.locationId,
        active: true,
        available: true,
      },
      include: {
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: {
              where: { active: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <TableSessionView
      session={{
        tableId: table.id,
        tableName: table.name,
        orderId: order.id,
        ticketNumber: order.ticketNumber,
        partySize: order.partySize,
        openMinutes: differenceInMinutes(new Date(), order.openedAt),
        waiterName: order.waiter?.name ?? order.waiter?.email ?? null,
        seats: order.seats.map((s) => ({
          id: s.id,
          label: s.label,
          displayName: s.displayName,
        })),
        checks: order.checks.map((check) => ({
          id: check.id,
          name: check.name,
          status: check.status,
          customerId: check.customerId,
          promotionId: check.promotionId,
          promotionCode: check.promotion?.code ?? null,
          subtotal: Number(check.subtotal).toFixed(2),
          discountTotal: Number(check.discountTotal).toFixed(2),
          taxTotal: Number(check.taxTotal).toFixed(2),
          total: Number(check.total).toFixed(2),
          items: check.items.map((item) => ({
            id: item.id,
            nameSnapshot: item.nameSnapshot,
            quantity: item.quantity,
            lineTotal: Number(item.lineTotal).toFixed(2),
            status: item.status,
            modifiers: item.modifiers.map((m) => m.nameSnapshot),
            seatId: item.seatId,
          })),
        })),
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        menuItems: menuItems.map((item) => ({
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          price: Number(item.price).toFixed(2),
          imageUrl: item.imageUrl,
          requiresPrep: item.requiresPrep,
          modifierGroups: item.modifierGroups.map((g) => ({
            id: g.id,
            name: g.name,
            required: g.required,
            minSelections: g.minSelections,
            maxSelections: g.maxSelections,
            options: g.options.map((o) => ({
              id: o.id,
              name: o.name,
              priceDelta: Number(o.priceDelta).toFixed(2),
            })),
          })),
        })),
      }}
    />
  );
}
