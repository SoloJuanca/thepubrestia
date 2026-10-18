import { format } from "date-fns";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { attendanceQrService } from "@/services/attendance-qr.service";
import { AttendanceStationView } from "@/features/attendance/components/AttendanceStationView";
import { BRAND } from "@/lib/brand";

export default async function AttendanceStationPage() {
  const { user } = await requirePermission("attendance", "update");
  const locationId = user.employeeProfile?.locationId;
  if (!locationId) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin sucursal asignada. No se puede mostrar el QR.
      </p>
    );
  }

  const location = await prisma.location.findUniqueOrThrow({
    where: { id: locationId },
  });
  const tokenRow = await attendanceQrService.ensureActiveToken(locationId);
  const base =
    process.env.AUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const scanUrl = `${base}/attendance/scan/${tokenRow.token}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(scanUrl)}`;

  return (
    <AttendanceStationView
      locationName={location.name || BRAND.name}
      scanUrl={scanUrl}
      qrImageUrl={qrImageUrl}
      expiresLabel={format(tokenRow.expiresAt, "dd/MM/yyyy HH:mm")}
    />
  );
}
