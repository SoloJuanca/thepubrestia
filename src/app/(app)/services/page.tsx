import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { serviceService } from "@/services/service.service";
import { ServicesAdminView } from "@/features/services/components/ServicesAdminView";

const RECURRENCE_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM: "Personalizado",
};

export default async function ServicesPage() {
  await requirePermission("services", "read");
  const canWrite =
    (await checkPermission("services", "create")) ||
    (await checkPermission("services", "update"));

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const [services, suppliers] = await Promise.all([
    serviceService.list(location.id),
    prisma.supplier.findMany({
      where: { locationId: location.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  return (
    <ServicesAdminView
      locationId={location.id}
      canWrite={canWrite}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      services={services.map((s) => {
        const next = s.nextServiceDate;
        const reminderMs =
          (s.reminderDaysBefore ?? 7) * 24 * 60 * 60 * 1000;
        const overdue = !!next && next < startOfToday && s.status === "ACTIVE";
        const upcoming =
          !!next &&
          !overdue &&
          s.status === "ACTIVE" &&
          next.getTime() - startOfToday.getTime() <= reminderMs;
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          expectedCost: Number(s.expectedCost).toFixed(2),
          recurrenceLabel: RECURRENCE_LABELS[s.recurrenceType] ?? s.recurrenceType,
          nextDateLabel: next ? format(next, "dd/MM/yyyy") : null,
          lastDateLabel: s.lastServiceDate
            ? format(s.lastServiceDate, "dd/MM/yyyy")
            : null,
          status: s.status,
          overdue,
          upcoming,
          supplierName: s.supplier?.name ?? null,
        };
      })}
    />
  );
}
