"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertPermission,
  AuthorizationError,
  getCurrentUser,
} from "@/lib/rbac";
import {
  adminResetPasswordSchema,
  changePasswordSchema,
} from "@/validations/auth";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Logged-in employee changes their own password. */
export async function changePasswordAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.type !== "EMPLOYEE") {
      return { ok: false, error: "Sesión requerida." };
    }
    const data = changePasswordSchema.parse(raw);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true, email: true },
    });
    if (!dbUser?.passwordHash) {
      return { ok: false, error: "Esta cuenta no tiene contraseña local." };
    }

    const valid = await bcrypt.compare(
      data.currentPassword,
      dbUser.passwordHash,
    );
    if (!valid) {
      return { ok: false, error: "La contraseña actual no es correcta." };
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: "PASSWORD_CHANGE",
        entity: "User",
        entityId: dbUser.id,
        after: { email: dbUser.email },
      },
    });

    revalidatePath("/account");
    return { ok: true, message: "Contraseña actualizada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo cambiar la contraseña." };
  }
}

/** Admin/manager with employees:update sets a new password for a staff user. */
export async function adminResetPasswordAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user: actor } = await assertPermission("employees", "update");
    const data = adminResetPasswordSchema.parse(raw);

    const target = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true, type: true, active: true },
    });
    if (!target || target.type !== "EMPLOYEE") {
      return { ok: false, error: "Empleado no encontrado." };
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "PASSWORD_RESET_ADMIN",
        entity: "User",
        entityId: target.id,
        after: { email: target.email, by: actor.email },
      },
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${target.id}`);
    return {
      ok: true,
      message: `Contraseña reiniciada para ${target.email}.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "No se pudo reiniciar la contraseña." };
  }
}
