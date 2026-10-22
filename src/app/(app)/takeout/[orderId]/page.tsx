import { notFound, redirect } from "next/navigation";
import { differenceInMinutes } from "date-fns";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { TableSessionView } from "@/features/pos/components/TableSessionView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

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

export default async function TakeoutOrderPage({ params }: Props) {
  await requirePermission("pos", "read");
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });

  if (!order || ["CLOSED", "CANCELLED"].includes(order.status)) notFound();
  if (order.tableId) redirect(`/pos/tables/${order.tableId}`);
  if (!order.guestName) notFound();

  const [categories, menuItems] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { locationId: order.locationId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.menuItem.findMany({
      where: {
        locationId: order.locationId,
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
        mode: "takeout",
        backHref: "/takeout",
        backLabel: "← Para llevar",
        tableId: "",
        tableName: order.guestName,
        orderId: order.id,
        ticketNumber: order.ticketNumber,
        partySize: order.partySize,
        openMinutes: differenceInMinutes(new Date(), order.openedAt),
        waiterName: order.waiter?.name ?? order.waiter?.email ?? null,
        seats: order.seats.map((seat) => ({
          id: seat.id,
          label: seat.label,
          displayName: seat.displayName,
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
            modifiers: item.modifiers.map((modifier) => modifier.nameSnapshot),
            notes: item.notes,
            seatId: item.seatId,
          })),
        })),
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
        })),
        menuItems: menuItems.map((item) => ({
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          price: Number(item.price).toFixed(2),
          imageUrl: item.imageUrl,
          requiresPrep: item.requiresPrep,
          modifierGroups: item.modifierGroups.map((group) => ({
            id: group.id,
            name: group.name,
            required: group.required,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            options: group.options.map((option) => ({
              id: option.id,
              name: option.name,
              priceDelta: Number(option.priceDelta).toFixed(2),
            })),
          })),
        })),
      }}
    />
  );
}
