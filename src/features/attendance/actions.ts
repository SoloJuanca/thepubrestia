"use server";

import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { isKitchenRole } from "@/lib/permissions";
import { attendanceService } from "@/services/attendance.service";
import { attendanceQrService } from "@/services/attendance-qr.service";
import {
  checkInSchema,
  checkOutSchema,
  correctAttendanceSchema,
} from "@/validations/ops";

export type ActionResult =
  | { ok: true; message?: string; id?: string; mode?: "in" | "out" }
  | { ok: false; error: string };

function revalidateAttendance(employeeUserId?: string) {
  revalidatePath("/attendance");
  revalidatePath("/attendance/station");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  if (employeeUserId) revalidatePath(`/employees/${employeeUserId}`);
}

function rolesOf(user: { roles: Array<{ role: { code: string } }> }) {
  return user.roles.map((r) => r.role.code);
}

/** Manual check-in blocked for kitchen roles — they must use venue QR. */
export async function checkInAction(raw?: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("attendance", "create");
    if (isKitchenRole(rolesOf(user))) {
      return {
        ok: false,
        error: "Cocina marca asistencia escaneando el QR del local.",
      };
    }
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
    return { ok: true, message: "Entrada registrada.", id: row.id, mode: "in" };
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
          : "No se pudo registrar la entrada.",
    };
  }
}

export async function checkOutAction(raw?: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("attendance", "create");
    if (isKitchenRole(rolesOf(user))) {
      return {
        ok: false,
        error: "Cocina marca asistencia escaneando el QR del local.",
      };
    }
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
    return { ok: true, message: "Salida registrada.", id: row.id, mode: "out" };
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
          : "No se pudo registrar la salida.",
    };
  }
}

/** Check-in or check-out after scanning the venue QR. */
export async function scanAttendanceQrAction(
  token: string,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("attendance", "create");
    const profile = user.employeeProfile;
    if (!profile) {
      return { ok: false, error: "No tienes perfil de empleado." };
    }

    await attendanceQrService.validateToken(token, profile.locationId);

    const open = await attendanceService.findOpen(profile.id);
    if (open) {
      const row = await attendanceService.checkOut({
        employeeId: profile.id,
        notes: "Salida vía QR local",
      });
      revalidateAttendance(user.id);
      return {
        ok: true,
        message: "Salida registrada (QR).",
        id: row.id,
        mode: "out",
      };
    }

    const row = await attendanceService.checkIn({
      employeeId: profile.id,
      locationId: profile.locationId,
      notes: "Entrada vía QR local",
    });
    revalidateAttendance(user.id);
    return {
      ok: true,
      message: "Entrada registrada (QR).",
      id: row.id,
      mode: "in",
    };
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
          : "No se pudo registrar con el QR.",
    };
  }
}

export async function rotateAttendanceQrAction(): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("attendance", "update");
    const locationId = user.employeeProfile?.locationId;
    if (!locationId) {
      return { ok: false, error: "Sin sucursal asignada." };
    }
    const token = await attendanceQrService.rotateToken(locationId);
    revalidateAttendance();
    return { ok: true, message: "QR renovado.", id: token.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo renovar el QR." };
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
