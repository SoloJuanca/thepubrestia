import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { reviewService } from "@/services/review.service";
import { ReviewsDashboard } from "@/features/reviews/components/ReviewsDashboard";

export default async function ReviewsPage() {
  await requirePermission("reviews", "read");
  const canCreate = await checkPermission("reviews", "create");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const [dash, recentOrders] = await Promise.all([
    reviewService.dashboard(location.id),
    prisma.order.findMany({
      where: { locationId: location.id, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      take: 20,
      include: { table: true },
    }),
  ]);

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : n.toFixed(1);

  return (
    <ReviewsDashboard
      canCreate={canCreate}
      averages={{
        overall: fmt(dash.avg._avg.overallRating),
        food: fmt(dash.avg._avg.foodRating),
        service: fmt(dash.avg._avg.serviceRating),
        ambience: fmt(dash.avg._avg.ambienceRating),
        count: dash.avg._count,
      }}
      recentOrderIds={recentOrders.map((o) => ({
        id: o.id,
        label: `#${o.ticketNumber ?? "—"} ${o.table?.name ?? ""} · ${
          o.closedAt ? format(o.closedAt, "dd/MM HH:mm") : ""
        }`,
      }))}
      reviews={dash.reviews.map((r) => ({
        id: r.id,
        overallRating: r.overallRating,
        foodRating: r.foodRating,
        serviceRating: r.serviceRating,
        ambienceRating: r.ambienceRating,
        comment: r.comment,
        guestName: r.guestName ?? r.customer?.user.name ?? null,
        waiterName: r.waiter?.name ?? null,
        tableName: r.table?.name ?? null,
        createdAtLabel: format(r.createdAt, "dd/MM/yyyy HH:mm"),
      }))}
    />
  );
}
