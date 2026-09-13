"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { customerService } from "@/services/customer.service";
import {
  assignCustomerPromoSchema,
  attachCustomerToCheckSchema,
  updateCustomerSchema,
  upsertCustomerSchema,
} from "@/validations/crm-finance";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function revalidateCustomers() {
  revalidatePath("/customers");
  revalidatePath("/pos");
  revalidatePath("/promotions");
}

export async function upsertCustomerAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("customers", "create");
    const data = upsertCustomerSchema.parse(raw);
    const profile = await customerService.upsertByEmail(data);
    if (data.name) {
      await prisma.user.update({
        where: { id: profile.userId },
        data: { name: data.name },
      });
    }
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CUSTOMER_UPSERT",
        entity: "CustomerProfile",
        entityId: profile.id,
        after: { email: data.email },
      },
    });
    revalidateCustomers();
    return { ok: true, message: "Cliente guardado.", id: profile.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar el cliente.",
    };
  }
}

export async function updateCustomerAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("customers", "update");
    const data = updateCustomerSchema.parse(raw);
    await customerService.updateProfile(data);
    revalidateCustomers();
    return { ok: true, message: "Cliente actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function assignCustomerPromoAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("promotions", "create");
    const data = assignCustomerPromoSchema.parse(raw);
    const row = await customerService.assignPromotion({
      customerId: data.customerId,
      promotionId: data.promotionId,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      assignedById: user.id,
    });
    revalidateCustomers();
    return { ok: true, message: "Promoción asignada al wallet.", id: row.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo asignar.",
    };
  }
}

export async function attachCustomerToCheckAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    // Waiters have customers:create (not update); linking is an operational write.
    try {
      await assertPermission("customers", "update");
    } catch {
      await assertPermission("customers", "create");
    }
    const data = attachCustomerToCheckSchema.parse(raw);
    await customerService.attachToCheck(data);
    revalidatePath("/pos");
    return { ok: true, message: "Cliente vinculado a la cuenta." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo vincular.",
    };
  }
}
