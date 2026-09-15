import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { attendanceService } from "@/services/attendance.service";
import { AttendanceView } from "@/features/attendance/components/AttendanceView";

export default async function AttendancePage() {
  const { user } = await requirePermission("attendance", "read");
  const canCheck = await checkPermission("attendance", "create");
  const canCorrect = await checkPermission("attendance", "update");
  const profile = user.employeeProfile;

  if (!profile) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes perfil de empleado vinculado.
      </p>
    );
  }

  const [todayRows, open] = await Promise.all([
    attendanceService.listToday(profile.locationId),
    attendanceService.findOpen(profile.id),
  ]);

  return (
    <AttendanceView
      employeeName={user.name}
      hasOpenAttendance={!!open}
      canCheck={canCheck}
      canCorrect={canCorrect}
      todayLabel={format(new Date(), "EEEE d MMM yyyy", { locale: es })}
      rows={todayRows.map((r) => ({
        id: r.id,
        employeeName: r.employee.user.name ?? r.employee.user.email,
        checkInLabel: format(r.checkInAt, "HH:mm"),
        checkOutLabel: r.checkOutAt ? format(r.checkOutAt, "HH:mm") : null,
        checkInIso: r.checkInAt.toISOString(),
        checkOutIso: r.checkOutAt?.toISOString() ?? null,
        status: r.status,
        notes: r.notes,
        isMine: r.employeeId === profile.id,
      }))}
    />
  );
}
