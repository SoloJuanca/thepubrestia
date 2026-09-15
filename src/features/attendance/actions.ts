"use server";

import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { attendanceService } from "@/services/attendance.service";
import {
  checkInSchema,
  checkOutSchema,
  correctAttendanceSchema,
} from "@/validations/ops";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function revalidateAttendance(employeeUserId?: string) {
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  if (employeeUserId) revalidatePath(`/employees/${employeeUserId}`);
}

export async function checkInAction(raw?: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("attendance", "create");
    const profile = user.employeeProfile;
    if (!profile) {
      return { ok: false, error: "No tienes perfil de empleado." };
    }

    const extra =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const parsed = checkInSchema.safeParse({
      employeeId: profile.id,
      locationId: profile.locationId,
      notes: extra.notes ?? null,
    });
    if (!parsed.success) {
      return { ok: false, error: "Datos inválidos." };
    }

    const row = await attendanceService.checkIn({
      employeeId: parsed.data.employeeId,
      locationId: parsed.data.locationId,
      notes: parsed.data.notes,
    });

    revalidateAttendance(user.id);
    return { ok: true, message: "Entrada registrada.", id: row.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo registrar la entrada.",
    };
  }
}

export async function checkOutAction(raw?: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("attendance", "create");
    const profile = user.employeeProfile;
    if (!profile) {
      return { ok: false, error: "No tienes perfil de empleado." };
    }

    const extra =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const parsed = checkOutSchema.safeParse({
      employeeId: profile.id,
      notes: extra.notes ?? null,
    });
    if (!parsed.success) {
      return { ok: false, error: "Datos inválidos." };
    }

    const row = await attendanceService.checkOut({
      employeeId: parsed.data.employeeId,
      notes: parsed.data.notes,
    });

    revalidateAttendance(user.id);
    return { ok: true, message: "Salida registrada.", id: row.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo registrar la salida.",
    };
  }
}

export async function correctAttendanceAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("attendance", "update");
    const data = correctAttendanceSchema.parse(raw);

    await attendanceService.correctAttendance({
      id: data.id,
      actorUserId: user.id,
      checkInAt: data.checkInAt ? new Date(data.checkInAt) : undefined,
      checkOutAt:
        data.checkOutAt === undefined
          ? undefined
          : data.checkOutAt
            ? new Date(data.checkOutAt)
            : null,
      status: data.status,
      notes: data.notes,
    });

    revalidateAttendance();
    return { ok: true, message: "Asistencia corregida (queda en auditoría)." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo corregir la asistencia.",
    };
  }
}
