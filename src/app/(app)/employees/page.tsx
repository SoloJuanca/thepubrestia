import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { EmployeeCreateForm } from "@/features/employees/components/EmployeeCreateForm";
import { EmployeesTable } from "@/features/employees/components/EmployeesTable";
import { RoleCode } from "@prisma/client";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function EmployeesPage() {
  await requirePermission("employees", "read");
  const canCreate = await checkPermission("employees", "create");

  const [employees, roles, locations, workingNow] = await Promise.all([
    prisma.user.findMany({
      where: { type: "EMPLOYEE" },
      include: {
        roles: { include: { role: true } },
        employeeProfile: {
          include: {
            location: true,
            compensation: true,
            schedules: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.employeeAttendance.count({
      where: { status: "OPEN" },
    }),
  ]);

  const activeCount = employees.filter((e) => e.active).length;
  const today = new Date();
  const weekdayMap = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ] as const;
  const todayWeekday = weekdayMap[today.getDay()]!;

  const dayOffToday = employees.filter((e) => {
    const sch = e.employeeProfile?.schedules.find(
      (s) => s.weekday === todayWeekday,
    );
    return Boolean(sch?.isDayOff);
  }).length;

  const payrollEstimate = employees.reduce((sum, e) => {
    if (!e.active || !e.employeeProfile?.compensation) return sum;
    return sum + Number(e.employeeProfile.compensation.amount);
  }, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alta, roles, horarios y compensación.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Activos" value={String(activeCount)} />
        <SummaryCard title="Trabajando ahora" value={String(workingNow)} />
        <SummaryCard title="Descanso hoy" value={String(dayOffToday)} />
        <SummaryCard
          title="Nómina estimada"
          value={`$${payrollEstimate.toLocaleString("es-MX", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}`}
        />
      </div>

      {canCreate ? (
        <EmployeeCreateForm
          roles={roles.map((r) => ({
            code: r.code as RoleCode,
            name: r.name,
          }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      ) : null}

      <EmployeesTable
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          active: e.active,
          role: e.roles[0]?.role.code ?? "—",
          location: e.employeeProfile?.location.name ?? "—",
          phone: e.employeeProfile?.phone ?? null,
        }))}
        roles={roles.map((r) => ({ code: r.code as RoleCode, name: r.name }))}
      />
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
