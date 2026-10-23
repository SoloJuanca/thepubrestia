"use server";

import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { publishLive } from "@/lib/live";
import { prisma } from "@/lib/prisma";
import { employeeMealService } from "@/services/employee-meal.service";
import { setEmployeeMealSchema } from "@/validations/staff-meal";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function locationForUser(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    include: { location: true },
  });
  if (profile?.location) return profile.location;
  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay sucursal activa.");
  return location;
}

export async function setEmployeeMealAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("staff_meal", "update");
    const data = setEmployeeMealSchema.parse(raw);
    const location = await locationForUser(user.id);
    await employeeMealService.setToday({
      locationId: location.id,
      timeZone: location.timezone,
      userId: user.id,
      name: data.name,
      notes: data.notes,
    });
    revalidatePath("/comida-empleado");
    return { ok: true, message: "Comida del día guardada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la comida.",
    };
  }
}

export async function orderEmployeeMealAction(): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("staff_meal", "read");
    const location = await locationForUser(user.id);
    await employeeMealService.orderMine({
      locationId: location.id,
      timeZone: location.timezone,
      userId: user.id,
      employeeName: user.name?.trim() || "Empleado",
      profileActive: user.employeeProfile?.active ?? null,
    });
    revalidatePath("/comida-empleado");
    revalidatePath("/kitchen");
    revalidatePath("/orders");
    void publishLive();
    return { ok: true, message: "Comanda enviada a cocina." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo pedir la comida.",
    };
  }
}
