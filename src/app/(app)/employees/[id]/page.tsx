import { notFound } from "next/navigation";
import { format } from "date-fns";
import { RoleCode, Weekday } from "@prisma/client";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { employeeOpsService } from "@/services/employee-ops.service";
import { EmployeeProfileView } from "@/features/employees/components/EmployeeProfileView";

type Props = { params: Promise<{ id: string }> };

const WEEKDAYS: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export default async function EmployeeDetailPage({ params }: Props) {
  await requirePermission("employees", "read");
  const { id } = await params;

  const [user, roles] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        employeeProfile: {
          include: {
            location: true,
            schedules: true,
            compensation: true,
            attendances: {
              orderBy: { checkInAt: "desc" },
              take: 30,
            },
            timeOffs: {
              orderBy: { date: "desc" },
              take: 40,
            },
          },
        },
      },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!user || user.type !== "EMPLOYEE" || !user.employeeProfile) {
    notFound();
  }

  const profile = user.employeeProfile;
  const byDay = new Map(profile.schedules.map((s) => [s.weekday, s]));
  const schedule =
    profile.schedules.length > 0
      ? WEEKDAYS.map((weekday) => {
          const s = byDay.get(weekday);
          return {
            weekday,
            startTime: s?.startTime ?? null,
            endTime: s?.endTime ?? null,
            isDayOff: s?.isDayOff ?? false,
          };
        })
      : employeeOpsService.defaultSchedule();

  return (
    <EmployeeProfileView
      employee={{
        id: user.id,
        name: user.name,
        email: user.email,
        active: user.active,
        role: user.roles[0]?.role.code ?? "WAITER",
        profileId: profile.id,
        phone: profile.phone,
        jobTitle: profile.jobTitle,
        locationId: profile.locationId,
        locationName: profile.location.name,
        hireDate: profile.hireDate
          ? format(profile.hireDate, "yyyy-MM-dd")
          : null,
      }}
      roles={roles.map((r) => ({
        code: r.code as RoleCode,
        name: r.name,
      }))}
      schedule={schedule}
      compensation={
        profile.compensation
          ? {
              type: profile.compensation.type,
              amount: Number(profile.compensation.amount).toFixed(2),
              bonuses: Number(profile.compensation.bonuses).toFixed(2),
              tipsNotes: profile.compensation.tipsNotes,
              notes: profile.compensation.notes,
            }
          : null
      }
      attendance={profile.attendances.map((a) => ({
        id: a.id,
        checkInAt: format(a.checkInAt, "dd/MM/yyyy HH:mm"),
        checkOutAt: a.checkOutAt
          ? format(a.checkOutAt, "dd/MM/yyyy HH:mm")
          : null,
        status: a.status,
        notes: a.notes,
      }))}
      timeOffs={profile.timeOffs.map((t) => ({
        id: t.id,
        type: t.type,
        dateLabel: format(t.date, "dd/MM/yyyy"),
        notes: t.notes,
      }))}
    />
  );
}
