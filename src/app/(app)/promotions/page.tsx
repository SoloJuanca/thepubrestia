import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PromotionsAdminView } from "@/features/promotions/components/PromotionsAdminView";

export default async function PromotionsPage() {
  await requirePermission("promotions", "read");
  const canWrite =
    (await checkPermission("promotions", "create")) ||
    (await checkPermission("promotions", "update"));

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const promotions = await prisma.promotion.findMany({
    where: { locationId: location.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PromotionsAdminView
      locationId={location.id}
      canWrite={canWrite}
      promotions={promotions.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        type: p.type,
        amount: Number(p.amount).toString(),
        active: p.active,
        startsAt: format(p.startsAt, "yyyy-MM-dd"),
        endsAt: p.endsAt ? format(p.endsAt, "yyyy-MM-dd") : null,
        appliesToEntireCheck: p.appliesToEntireCheck,
        perCustomerLimit: p.perCustomerLimit,
        totalLimit: p.totalLimit,
      }))}
    />
  );
}
