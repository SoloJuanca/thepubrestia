"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "@/validations/employee";

export type ActionResult =
  | { ok: true; message?: string }
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

    await prisma.user.create({
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
            hireDate: new Date(),
            active: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "EMPLOYEE_CREATE",
        entity: "User",
        after: { email: data.email, role: data.roleCode },
      },
    });

    revalidatePath("/employees");
    return { ok: true, message: "Empleado creado." };
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
    return { ok: true, message: "Empleado actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo actualizar el empleado." };
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
