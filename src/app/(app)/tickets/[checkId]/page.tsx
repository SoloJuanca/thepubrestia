import { format } from "date-fns";
import { notFound } from "next/navigation";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { BRAND } from "@/lib/brand";
import { paymentService } from "@/services/payment.service";
import { TicketPageClient } from "@/features/payments/components/TicketPageClient";

type Props = { params: Promise<{ checkId: string }> };

export default async function TicketPage({ params }: Props) {
  await requirePermission("payments", "read");
  const canMintReview = await checkPermission("reviews", "create");
  const { checkId } = await params;

  let check;
  try {
    check = await paymentService.getCheckReceipt(checkId);
  } catch {
    notFound();
  }

  if (check.status !== "CLOSED") {
    notFound();
  }

  return (
    <TicketPageClient
      checkId={check.id}
      orderId={check.orderId}
      tableId={check.order.tableId}
      canMintReview={canMintReview}
      ticket={{
        restaurantName: BRAND.name,
        address: check.order.location.address ?? BRAND.address,
        phone: check.order.location.phone ?? BRAND.phone,
        email: BRAND.email,
        website: BRAND.website,
        ticketNumber: check.order.ticketNumber,
        tableName: check.order.table?.name
          ? check.order.table.name
          : check.order.guestName
            ? `Para llevar · ${check.order.guestName}`
            : null,
        waiterName:
          check.order.waiter?.name ?? check.order.waiter?.email ?? null,
        checkName: check.name,
        issuedAtLabel: format(check.closedAt ?? new Date(), "dd/MM/yyyy HH:mm"),
        widthMm: 84,
        lines: check.items.map((item) => ({
          name: item.nameSnapshot,
          quantity: item.quantity,
          modifiers: item.modifiers.map((m) => m.nameSnapshot),
          lineTotal: Number(item.lineTotal).toFixed(2),
        })),
        subtotal: Number(check.subtotal).toFixed(2),
        discountTotal: Number(check.discountTotal).toFixed(2),
        taxTotal: Number(check.taxTotal).toFixed(2),
        total: Number(check.total).toFixed(2),
        payments: check.payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount).toFixed(2),
        })),
      }}
    />
  );
}
