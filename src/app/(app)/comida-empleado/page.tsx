import { hasPermission } from "@/lib/permissions";
import { flattenPermissions, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatServiceDate } from "@/lib/service-date";
import { StaffMealPanel } from "@/features/staff-meal/components/StaffMealPanel";
import { employeeMealService } from "@/services/employee-meal.service";

export const dynamic = "force-dynamic";

export default async function StaffMealPage() {
  const { user } = await requirePermission("staff_meal", "read");
  const permissions = flattenPermissions(user);
  const canEdit = hasPermission(permissions, "staff_meal", "update");

  const profile = user.employeeProfile
    ? await prisma.location.findUnique({
        where: { id: user.employeeProfile.locationId },
      })
    : null;
  const location =
    profile ??
    (await prisma.location.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    }));

  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const today = await employeeMealService.today(
    location.id,
    location.timezone,
    user.id,
  );

  return (
    <StaffMealPanel
      dateLabel={formatServiceDate(location.timezone)}
      canEdit={canEdit}
      meal={today.meal}
      mine={today.mine}
      orders={canEdit ? today.orders : []}
    />
  );
}
