"use server";

import { revalidatePath } from "next/cache";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { serviceService } from "@/services/service.service";
import {
  completeServiceSchema,
  createServiceSchema,
  deleteServiceSchema,
  updateServiceSchema,
} from "@/validations/ops";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function emptyToNull(v?: string | null) {
  if (v == null || v === "") return null;
  return v;
}

function revalidateServices() {
  revalidatePath("/services");
  revalidatePath("/expenses");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function createServiceAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("services", "create");
    const data = createServiceSchema.parse(raw);
    const service = await serviceService.create({
      locationId: data.locationId,
      name: data.name,
      description: emptyToNull(data.description),
      category: emptyToNull(data.category),
      supplierId: emptyToNull(data.supplierId),
      expectedCost: data.expectedCost,
      recurrenceType: data.recurrenceType,
      recurrenceInterval: data.recurrenceInterval,
      nextServiceDate: data.nextServiceDate
        ? new Date(data.nextServiceDate)
        : null,
      reminderDaysBefore: data.reminderDaysBefore,
      notes: emptyToNull(data.notes),
    });

    revalidateServices();
    return { ok: true, message: "Servicio creado.", id: service.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear el servicio.",
    };
  }
}

export async function updateServiceAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("services", "update");
    const data = updateServiceSchema.parse(raw);
    await serviceService.update(data.id, {
      name: data.name,
      description:
        data.description === undefined ? undefined : emptyToNull(data.description),
      category: data.category === undefined ? undefined : emptyToNull(data.category),
      supplierId:
        data.supplierId === undefined ? undefined : emptyToNull(data.supplierId),
      expectedCost: data.expectedCost,
      recurrenceType: data.recurrenceType,
      recurrenceInterval: data.recurrenceInterval,
      nextServiceDate:
        data.nextServiceDate === undefined
          ? undefined
          : data.nextServiceDate
            ? new Date(data.nextServiceDate)
            : null,
      lastServiceDate:
        data.lastServiceDate === undefined
          ? undefined
          : data.lastServiceDate
            ? new Date(data.lastServiceDate)
            : null,
      reminderDaysBefore: data.reminderDaysBefore,
      status: data.status,
      notes: data.notes === undefined ? undefined : emptyToNull(data.notes),
    });
    revalidateServices();
    return { ok: true, message: "Servicio actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function archiveServiceAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("services", "update");
    const data = deleteServiceSchema.parse(raw);
    await serviceService.archive(data.id);
    revalidateServices();
    return { ok: true, message: "Servicio archivado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo archivar.",
    };
  }
}

export async function completeServiceAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("services", "update");
    const data = completeServiceSchema.parse(raw);
    const result = await serviceService.completeService({
      serviceId: data.serviceId,
      performedAt: new Date(data.performedAt),
      actualCost: data.actualCost,
      notes: emptyToNull(data.notes),
      employeeUserId: data.employeeUserId ?? user.id,
    });
    revalidateServices();
    return {
      ok: true,
      message: "Servicio completado y gasto registrado.",
      id: result.log.id,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo completar el servicio.",
    };
  }
}
