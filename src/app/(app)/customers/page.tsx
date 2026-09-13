import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CustomersAdminView } from "@/features/customers/components/CustomersAdminView";

export default async function CustomersPage() {
  await requirePermission("customers", "read");
  const canWrite =
    (await checkPermission("customers", "create")) ||
    (await checkPermission("customers", "update"));
  const canAssignPromo = await checkPermission("promotions", "create");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const [customers, promotions] = await Promise.all([
    prisma.customerProfile.findMany({
      include: {
        user: true,
        promotions: {
          include: { promotion: true },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    location
      ? prisma.promotion.findMany({
          where: { locationId: location.id, active: true },
          orderBy: { code: "asc" },
        })
      : [],
  ]);

  return (
    <CustomersAdminView
      canWrite={canWrite}
      canAssignPromo={canAssignPromo}
      promotions={promotions.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
      }))}
      customers={customers.map((c) => ({
        id: c.id,
        name: c.user.name,
        email: c.user.email,
        phone: c.phone,
        visits: c.visits,
        lifetimeSpend: Number(c.lifetimeSpend).toFixed(2),
        lastVisitLabel: c.lastVisitAt
          ? format(c.lastVisitAt, "dd/MM/yyyy")
          : null,
        wallet: c.promotions.map((w) => ({
          id: w.id,
          promoName: w.promotion.name,
          promoCode: w.promotion.code,
          used: w.used,
          expiresLabel: w.expiresAt
            ? format(w.expiresAt, "dd/MM/yyyy")
            : null,
        })),
      }))}
    />
  );
}
