import type { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

function localDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
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
    });
    if (!employee || !employee.active) {
      throw new Error("Empleado no encontrado o inactivo.");
    }

    const open = await this.findOpen(params.employeeId);
    if (open) {
      throw new Error("Ya tienes una asistencia abierta. Registra la salida primero.");
    }

    return prisma.employeeAttendance.create({
      data: {
        employeeId: params.employeeId,
        locationId: params.locationId,
        checkInAt: new Date(),
        status: "OPEN",
        notes: params.notes?.trim() || null,
      },
      include: {
        employee: { include: { user: true } },
        location: true,
      },
    });
  }

  async checkOut(params: { employeeId: string; notes?: string | null }) {
    const open = await this.findOpen(params.employeeId);
    if (!open) {
      throw new Error("No hay una asistencia abierta para registrar salida.");
    }

    const notes =
      params.notes === undefined
        ? open.notes
        : params.notes?.trim() || open.notes;

    return prisma.employeeAttendance.update({
      where: { id: open.id },
      data: {
        checkOutAt: new Date(),
        status: "COMPLETE" satisfies AttendanceStatus,
        notes,
      },
      include: {
        employee: { include: { user: true } },
        location: true,
      },
    });
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
