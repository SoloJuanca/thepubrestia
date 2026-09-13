"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import {
  createSupplierSchema,
  removeSupplierProductSchema,
  saveSchedulesSchema,
  saveSupplierProductSchema,
  updateSupplierSchema,
} from "@/validations/purchase";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function revalidateSuppliers() {
  revalidatePath("/suppliers");
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

function emptyToNull(value?: string | null) {
  if (value == null || value === "") return null;
  return value;
}

export async function createSupplierAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("suppliers", "create");
    const data = createSupplierSchema.parse(raw);

    const supplier = await prisma.supplier.create({
      data: {
        locationId: data.locationId,
        name: data.name.trim(),
        contact: emptyToNull(data.contact),
        phone: emptyToNull(data.phone),
        whatsapp: emptyToNull(data.whatsapp),
        email: emptyToNull(data.email),
        notes: emptyToNull(data.notes),
        active: data.active,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "SUPPLIER_CREATE",
        entity: "Supplier",
        entityId: supplier.id,
        after: { name: supplier.name },
      },
    });

    revalidateSuppliers();
    return { ok: true, message: "Proveedor creado.", id: supplier.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo crear el proveedor.",
    };
  }
}

export async function updateSupplierAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("suppliers", "update");
    const data = updateSupplierSchema.parse(raw);

    const existing = await prisma.supplier.findUnique({
      where: { id: data.id },
    });
    if (!existing) return { ok: false, error: "Proveedor no encontrado." };

    const updated = await prisma.supplier.update({
      where: { id: data.id },
      data: {
        name: data.name?.trim(),
        contact:
          data.contact === undefined ? undefined : emptyToNull(data.contact),
        phone: data.phone === undefined ? undefined : emptyToNull(data.phone),
        whatsapp:
          data.whatsapp === undefined ? undefined : emptyToNull(data.whatsapp),
        email: data.email === undefined ? undefined : emptyToNull(data.email),
        notes: data.notes === undefined ? undefined : emptyToNull(data.notes),
        active: data.active,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "SUPPLIER_UPDATE",
        entity: "Supplier",
        entityId: updated.id,
        before: { name: existing.name, active: existing.active },
        after: { name: updated.name, active: updated.active },
      },
    });

    revalidateSuppliers();
    return { ok: true, message: "Proveedor actualizado." };
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
          : "No se pudo actualizar el proveedor.",
    };
  }
}

export async function saveSchedulesAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("suppliers", "update");
    const data = saveSchedulesSchema.parse(raw);

    await prisma.$transaction(async (tx) => {
      await tx.supplierSchedule.deleteMany({
        where: { supplierId: data.supplierId },
      });
      if (data.schedules.length) {
        await tx.supplierSchedule.createMany({
          data: data.schedules.map((s) => ({
            supplierId: data.supplierId,
            orderDay: s.orderDay,
            deliveryDay: s.deliveryDay,
          })),
        });
      }
    });

    revalidateSuppliers();
    return { ok: true, message: "Calendario guardado." };
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
          : "No se pudo guardar el calendario.",
    };
  }
}

export async function upsertSupplierProductAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("suppliers", "update");
    const data = saveSupplierProductSchema.parse(raw);

    const product = await prisma.supplierProduct.upsert({
      where: {
        supplierId_ingredientId: {
          supplierId: data.supplierId,
          ingredientId: data.ingredientId,
        },
      },
      create: {
        supplierId: data.supplierId,
        ingredientId: data.ingredientId,
        supplierSku: emptyToNull(data.supplierSku),
        unit: data.unit,
        unitCost: data.unitCost,
        minOrderQty: data.minOrderQty ?? null,
        active: data.active,
      },
      update: {
        supplierSku: emptyToNull(data.supplierSku),
        unit: data.unit,
        unitCost: data.unitCost,
        minOrderQty: data.minOrderQty ?? null,
        active: data.active,
      },
    });

    revalidateSuppliers();
    return {
      ok: true,
      message: "Producto de catálogo guardado.",
      id: product.id,
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
          : "No se pudo guardar el producto.",
    };
  }
}

export async function removeSupplierProductAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("suppliers", "update");
    const data = removeSupplierProductSchema.parse(raw);
    await prisma.supplierProduct.delete({ where: { id: data.id } });
    revalidateSuppliers();
    return { ok: true, message: "Producto eliminado del catálogo." };
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
          : "No se pudo eliminar el producto.",
    };
  }
}
