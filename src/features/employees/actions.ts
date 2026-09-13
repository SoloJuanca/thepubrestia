"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { employeeOpsService } from "@/services/employee-ops.service";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  upsertCompensationSchema,
  upsertScheduleSchema,
} from "@/validations/employee";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

export async function createEmployeeAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("employees", "create");
    const data = createEmployeeSchema.parse(raw);

    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      return { ok: false, error: "Ya existe un usuario con ese correo." };
    }

    const role = await prisma.role.findUnique({
      where: { code: data.roleCode },
    });
    if (!role) return { ok: false, error: "Rol inválido." };

    const location = await prisma.location.findUnique({
      where: { id: data.locationId },
    });
    if (!location) return { ok: false, error: "Sucursal inválida." };

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash,
        type: "EMPLOYEE",
        active: true,
        roles: { create: { roleId: role.id } },
        employeeProfile: {
          create: {
            locationId: data.locationId,
            phone: data.phone,
            jobTitle: data.jobTitle ?? null,
            hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
            active: true,
          },
        },
      },
      include: { employeeProfile: true },
    });

    const profileId = user.employeeProfile!.id;

    if (data.schedule?.length) {
      await employeeOpsService.upsertSchedule(profileId, data.schedule);
    } else {
      await employeeOpsService.upsertSchedule(
        profileId,
        employeeOpsService.defaultSchedule(),
      );
    }

    if (data.compensation) {
      await employeeOpsService.upsertCompensation({
        employeeId: profileId,
        type: data.compensation.type,
        amount: data.compensation.amount,
        bonuses: data.compensation.bonuses,
        tipsNotes: data.compensation.tipsNotes,
        notes: data.compensation.notes,
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "EMPLOYEE_CREATE",
        entity: "User",
        entityId: user.id,
        after: { email: data.email, role: data.roleCode },
      },
    });

    revalidatePath("/employees");
    return { ok: true, message: "Empleado creado.", id: user.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo crear el empleado." };
  }
}

export async function updateEmployeeAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("employees", "update");
    const data = updateEmployeeSchema.parse(raw);

    const user = await prisma.user.findUnique({
      where: { id: data.id },
      include: { roles: true, employeeProfile: true },
    });
    if (!user || user.type !== "EMPLOYEE") {
      return { ok: false, error: "Empleado no encontrado." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: data.id },
        data: {
          name: data.name ?? undefined,
          active: data.active ?? undefined,
        },
      });

      if (user.employeeProfile) {
        await tx.employeeProfile.update({
          where: { userId: data.id },
          data: {
            phone: data.phone === undefined ? undefined : data.phone,
            active: data.active ?? undefined,
            jobTitle:
              data.jobTitle === undefined ? undefined : data.jobTitle,
          },
        });
      }

      if (data.roleCode) {
        const role = await tx.role.findUnique({
          where: { code: data.roleCode },
        });
        if (!role) throw new Error("Rol inválido");
        await tx.userRole.deleteMany({ where: { userId: data.id } });
        await tx.userRole.create({
          data: { userId: data.id, roleId: role.id },
        });
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "EMPLOYEE_UPDATE",
        entity: "User",
        entityId: data.id,
        before: { name: user.name, active: user.active },
        after: data,
      },
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${data.id}`);
    return { ok: true, message: "Empleado actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo actualizar el empleado." };
  }
}

export async function upsertEmployeeScheduleAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("employees", "update");
    const data = upsertScheduleSchema.parse(raw);
    await employeeOpsService.upsertSchedule(data.employeeProfileId, data.days);
    const profile = await prisma.employeeProfile.findUnique({
      where: { id: data.employeeProfileId },
    });
    if (profile) revalidatePath(`/employees/${profile.userId}`);
    revalidatePath("/employees");
    return { ok: true, message: "Horario guardado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo guardar el horario." };
  }
}

export async function upsertEmployeeCompensationAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("employees", "update");
    const data = upsertCompensationSchema.parse(raw);
    await employeeOpsService.upsertCompensation({
      employeeId: data.employeeProfileId,
      type: data.type,
      amount: data.amount,
      bonuses: data.bonuses,
      tipsNotes: data.tipsNotes,
      notes: data.notes,
    });
    const profile = await prisma.employeeProfile.findUnique({
      where: { id: data.employeeProfileId },
    });
    if (profile) revalidatePath(`/employees/${profile.userId}`);
    return { ok: true, message: "Compensación guardada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo guardar la compensación." };
  }
}

export async function deactivateEmployeeAction(
  id: string,
): Promise<ActionResult> {
  return updateEmployeeAction({ id, active: false });
}

export async function listRoles() {
  return prisma.role.findMany({ orderBy: { name: "asc" } });
}
