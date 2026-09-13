"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { purchaseOrderService } from "@/services/purchase-order.service";
import {
  createPurchaseOrderSchema,
  createSuggestedPosSchema,
  receivePoSchema,
  replacePoItemsSchema,
  setPoStatusSchema,
} from "@/validations/purchase";

export type ActionResult =
  | { ok: true; message?: string; id?: string; ids?: string[] }
  | { ok: false; error: string };

function revalidatePurchases() {
  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function createPurchaseOrderAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("purchases", "create");
    const data = createPurchaseOrderSchema.parse(raw);

    const po = await purchaseOrderService.createDraft({
      locationId: data.locationId,
      supplierId: data.supplierId,
      notes: data.notes,
      createdById: user.id,
      items: data.items,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PO_CREATE",
        entity: "PurchaseOrder",
        entityId: po.id,
        after: {
          supplierId: data.supplierId,
          itemCount: data.items.length,
        },
      },
    });

    revalidatePurchases();
    return { ok: true, message: "Orden de compra creada.", id: po.id };
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
          : "No se pudo crear la orden de compra.",
    };
  }
}

export async function replacePoItemsAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("purchases", "update");
    const data = replacePoItemsSchema.parse(raw);
    await purchaseOrderService.replaceDraftItems(data.poId, data.items);
    revalidatePurchases();
    return { ok: true, message: "Ítems actualizados." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudieron guardar ítems.",
    };
  }
}

export async function setPoStatusAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("purchases", "update");
    const data = setPoStatusSchema.parse(raw);
    const po = await purchaseOrderService.setStatus(data);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PO_STATUS",
        entity: "PurchaseOrder",
        entityId: po.id,
        after: { status: po.status },
      },
    });

    revalidatePurchases();
    return {
      ok: true,
      message:
        data.status === "CANCELLED"
          ? "Orden cancelada."
          : data.status === "ORDERED"
            ? "Orden marcada como pedida."
            : "Orden enviada a pendiente.",
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
          : "No se pudo actualizar el estado.",
    };
  }
}

export async function receivePurchaseOrderAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("purchases", "update");
    await assertPermission("inventory", "adjust");
    const data = receivePoSchema.parse(raw);

    const po = await purchaseOrderService.receive({
      poId: data.poId,
      lines: data.lines,
      employeeId: user.id,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PO_RECEIVE",
        entity: "PurchaseOrder",
        entityId: po.id,
        after: {
          status: po.status,
          lines: data.lines,
        },
      },
    });

    revalidatePurchases();
    return {
      ok: true,
      message:
        po.status === "RECEIVED"
          ? "Recepción completa. Stock actualizado."
          : "Recepción parcial registrada.",
      id: po.id,
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
          : "No se pudo registrar la recepción.",
    };
  }
}

export async function createSuggestedPosAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("purchases", "create");
    const data = createSuggestedPosSchema.parse(raw);
    const result = await purchaseOrderService.createSuggestedDrafts({
      locationId: data.locationId,
      createdById: user.id,
    });

    if (result.created.length) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PO_SUGGESTED",
          entity: "PurchaseOrder",
          after: { ids: result.created },
        },
      });
    }

    revalidatePurchases();
    return {
      ok: true,
      message: result.message,
      ids: result.created,
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
          : "No se pudieron generar pedidos sugeridos.",
    };
  }
}
