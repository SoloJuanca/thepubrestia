import type { AttendanceStatus, Prisma, Weekday } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

const WEEKDAY_FROM_JS: Weekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

function localDayRange(date = new Date()) {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return { start, end };
}

function parseHm(hm: string, base: Date) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

/** Pure helper: late if check-in > start + graceMinutes */
export function resolveCheckInStatus(params: {
  checkInAt: Date;
  startTime: string | null;
  isDayOff: boolean;
  graceMinutes?: number;
}): AttendanceStatus {
  if (params.isDayOff) return "OPEN";
  if (!params.startTime) return "OPEN";
  const grace = params.graceMinutes ?? 10;
  const start = parseHm(params.startTime, params.checkInAt);
  const lateAfter = new Date(start.getTime() + grace * 60_000);
  if (params.checkInAt > lateAfter) return "LATE";
  return "ON_TIME";
}

export function resolveCheckOutStatus(params: {
  checkInStatus: AttendanceStatus;
  checkOutAt: Date;
  endTime: string | null;
  isDayOff: boolean;
  earlyMinutes?: number;
}): AttendanceStatus {
  if (params.isDayOff || !params.endTime) {
    return params.checkInStatus === "LATE" ? "LATE" : "COMPLETE";
  }
  const earlyThreshold = params.earlyMinutes ?? 15;
  const end = parseHm(params.endTime, params.checkOutAt);
  const earlyBefore = new Date(end.getTime() - earlyThreshold * 60_000);
  if (params.checkOutAt < earlyBefore) return "EARLY_LEAVE";
  if (params.checkInStatus === "LATE") return "LATE";
  return "COMPLETE";
}

export class AttendanceService {
  async findOpen(employeeId: string, db: Tx = prisma) {
    return db.employeeAttendance.findFirst({
      where: { employeeId, status: "OPEN" },
      orderBy: { checkInAt: "desc" },
    });
  }

  async checkIn(params: {
    employeeId: string;
    locationId: string;
    notes?: string | null;
  }) {
    const employee = await prisma.employeeProfile.findUnique({
      where: { id: params.employeeId },
      include: { schedules: true },
    });
    if (!employee || !employee.active) {
      throw new Error("Empleado no encontrado o inactivo.");
    }

    const open = await this.findOpen(params.employeeId);
    if (open) {
      throw new Error(
        "Ya tienes una asistencia abierta. Registra la salida primero.",
      );
    }

    const checkInAt = new Date();
    const weekday = WEEKDAY_FROM_JS[checkInAt.getDay()]!;
    const schedule = employee.schedules.find((s) => s.weekday === weekday);
    const provisional = resolveCheckInStatus({
      checkInAt,
      startTime: schedule?.startTime ?? null,
      isDayOff: Boolean(schedule?.isDayOff),
    });

    try {
      return await prisma.employeeAttendance.create({
        data: {
          employeeId: params.employeeId,
          locationId: params.locationId,
          checkInAt,
          status: "OPEN",
          openShiftKey: params.employeeId,
          notes:
            [params.notes?.trim(), provisional === "LATE" ? "Retardo detectado" : null]
              .filter(Boolean)
              .join(" · ") || null,
        },
        include: {
          employee: { include: { user: true } },
          location: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /Unique constraint|openShiftKey/i.test(error.message)
      ) {
        throw new Error(
          "Ya tienes una asistencia abierta. Registra la salida primero.",
        );
      }
      throw error;
    }
  }

  async checkOut(params: { employeeId: string; notes?: string | null }) {
    const open = await this.findOpen(params.employeeId);
    if (!open) {
      throw new Error("No hay una asistencia abierta para registrar salida.");
    }

    const employee = await prisma.employeeProfile.findUnique({
      where: { id: params.employeeId },
      include: { schedules: true },
    });
    const checkOutAt = new Date();
    const weekday = WEEKDAY_FROM_JS[checkOutAt.getDay()]!;
    const schedule = employee?.schedules.find((s) => s.weekday === weekday);
    const checkInStatus = resolveCheckInStatus({
      checkInAt: open.checkInAt,
      startTime: schedule?.startTime ?? null,
      isDayOff: Boolean(schedule?.isDayOff),
    });
    const finalStatus = resolveCheckOutStatus({
      checkInStatus,
      checkOutAt,
      endTime: schedule?.endTime ?? null,
      isDayOff: Boolean(schedule?.isDayOff),
    });

    const notes =
      params.notes === undefined
        ? open.notes
        : params.notes?.trim() || open.notes;

    return prisma.employeeAttendance.update({
      where: { id: open.id },
      data: {
        checkOutAt,
        status: finalStatus,
        openShiftKey: null,
        notes,
      },
      include: {
        employee: { include: { user: true } },
        location: true,
      },
    });
  }

  async correctAttendance(params: {
    id: string;
    actorUserId: string;
    checkInAt?: Date;
    checkOutAt?: Date | null;
    status?: AttendanceStatus;
    notes?: string | null;
  }) {
    const existing = await prisma.employeeAttendance.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new Error("Registro de asistencia no encontrado.");

    const nextStatus = params.status ?? existing.status;
    const updated = await prisma.employeeAttendance.update({
      where: { id: params.id },
      data: {
        checkInAt: params.checkInAt ?? undefined,
        checkOutAt:
          params.checkOutAt === undefined ? undefined : params.checkOutAt,
        status: nextStatus,
        notes: params.notes === undefined ? undefined : params.notes,
        openShiftKey:
          nextStatus === "OPEN" ? existing.employeeId : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: params.actorUserId,
        action: "ATTENDANCE_CORRECT",
        entity: "EmployeeAttendance",
        entityId: existing.id,
        before: {
          checkInAt: existing.checkInAt.toISOString(),
          checkOutAt: existing.checkOutAt?.toISOString() ?? null,
          status: existing.status,
          notes: existing.notes,
        },
        after: {
          checkInAt: updated.checkInAt.toISOString(),
          checkOutAt: updated.checkOutAt?.toISOString() ?? null,
          status: updated.status,
          notes: updated.notes,
        },
      },
    });

    return updated;
  }

  async listByLocation(
    locationId: string,
    opts?: { from?: Date; to?: Date; status?: AttendanceStatus },
  ) {
    const from = opts?.from;
    const to = opts?.to;
    return prisma.employeeAttendance.findMany({
      where: {
        locationId,
        ...(opts?.status ? { status: opts.status } : {}),
        ...(from || to
          ? {
              checkInAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
      },
      include: {
        employee: { include: { user: true } },
        location: true,
      },
      orderBy: { checkInAt: "desc" },
    });
  }

  async listByEmployee(
    employeeId: string,
    opts?: { from?: Date; to?: Date },
  ) {
    const from = opts?.from;
    const to = opts?.to;
    return prisma.employeeAttendance.findMany({
      where: {
        employeeId,
        ...(from || to
          ? {
              checkInAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
      },
      include: {
        employee: { include: { user: true } },
        location: true,
      },
      orderBy: { checkInAt: "desc" },
    });
  }

  async listToday(locationId: string) {
    const { start, end } = localDayRange();
    return this.listByLocation(locationId, { from: start, to: end });
  }
}

export const attendanceService = new AttendanceService();
