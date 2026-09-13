import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { EmployeeCreateForm } from "@/features/employees/components/EmployeeCreateForm";
import { EmployeesTable } from "@/features/employees/components/EmployeesTable";
import { RoleCode } from "@prisma/client";

export default async function EmployeesPage() {
  await requirePermission("employees", "read");

  const [employees, roles, locations] = await Promise.all([
    prisma.user.findMany({
      where: { type: "EMPLOYEE" },
      include: {
        roles: { include: { role: true } },
        employeeProfile: { include: { location: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canCreate = true;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alta, roles y desactivación. Los registros históricos se conservan.
          </p>
        </div>
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
