import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { dailyCloseService } from "@/services/daily-close.service";
import { DailyClosePanel } from "@/features/payments/components/DailyClosePanel";

type Props = { searchParams: Promise<{ date?: string }> };

function parseBusinessDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(Date.UTC(y, m - 1, d));
}

export default async function DailyClosePage({ searchParams }: Props) {
  await requirePermission("daily_close", "read");
  const canConfirm = await checkPermission("daily_close", "create");
  const params = await searchParams;

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const dateStr = params.date ?? format(new Date(), "yyyy-MM-dd");
  const businessDate = parseBusinessDate(dateStr);

  const [preview, existing] = await Promise.all([
    dailyCloseService.preview(location.id, businessDate),
    prisma.dailyClose.findUnique({
      where: {
        locationId_businessDate: {
          locationId: location.id,
          businessDate,
        },
      },
    }),
  ]);

  return (
    <DailyClosePanel
      canConfirm={canConfirm && !existing}
      preview={{
        businessDate: dateStr,
        salesTotal: preview.salesTotal.toFixed(2),
        cashExpected: preview.cashExpected.toFixed(2),
        cardTotal: preview.cardTotal.toFixed(2),
        transferTotal: preview.transferTotal.toFixed(2),
        tipsTotal: preview.tipsTotal.toFixed(2),
        discountsTotal: preview.discountsTotal.toFixed(2),
        cancellationsTotal: preview.cancellationsTotal.toFixed(2),
        wasteTotal: preview.wasteTotal.toFixed(2),
        orderCount: preview.orderCount,
        paymentCount: preview.paymentCount,
        checkCount: preview.checkCount,
        alreadyClosed: Boolean(existing),
        closedAtLabel: existing
          ? format(existing.closedAt, "dd/MM/yyyy HH:mm")
          : null,
      }}
    />
  );
}
