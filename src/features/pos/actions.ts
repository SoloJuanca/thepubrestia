"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { orderService } from "@/services/order.service";
import {
  addCheckSchema,
  addItemSchema,
  addSeatSchema,
  assignSeatSchema,
  endSessionSchema,
  itemIdSchema,
  kitchenStatusSchema,
  moveItemsSchema,
  openTableSchema,
  renameCheckSchema,
  renameSeatSchema,
  sendKitchenSchema,
  splitBySeatsSchema,
  splitCustomSchema,
  splitEqualSchema,
  tableStatusSchema,
  updateQtySchema,
} from "@/validations/pos";

export type ActionResult =
  | { ok: true; message?: string; id?: string; count?: number }
  | { ok: false; error: string };

function revalidatePos(tableId?: string) {
  revalidatePath("/pos");
  revalidatePath("/orders");
  revalidatePath("/kitchen");
  revalidatePath("/dashboard");
  if (tableId) revalidatePath(`/pos/tables/${tableId}`);
}

async function resolveLocationId(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
  });
  if (profile?.locationId) return profile.locationId;
  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay sucursal activa.");
  return location.id;
}

export async function openTableAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("pos", "create");
    const data = openTableSchema.parse(raw);
    const locationId = await resolveLocationId(user.id);
    const order = await orderService.openTable({
      locationId,
      tableId: data.tableId,
      waiterId: data.waiterId || user.id,
      checkName: data.checkName,
      partySize: data.partySize,
      notes: data.notes,
    });
    revalidatePos(data.tableId);
    return { ok: true, message: "Mesa abierta.", id: order.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo abrir la mesa.",
    };
  }
}

export async function addCheckAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = addCheckSchema.parse(raw);
    const check = await orderService.addCheck(data);
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
    });
    revalidatePos(order?.tableId ?? undefined);
    return { ok: true, message: "Cuenta creada.", id: check.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear la cuenta.",
    };
  }
}

export async function renameCheckAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("checks", "update");
    const data = renameCheckSchema.parse(raw);
    await orderService.renameCheck(data);
    revalidatePos();
    return { ok: true, message: "Cuenta renombrada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo renombrar.",
    };
  }
}

export async function addOrderItemAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = addItemSchema.parse(raw);
    const item = await orderService.addItem(data);
    const check = await prisma.check.findUnique({
      where: { id: data.checkId },
      include: { order: true },
    });
    revalidatePos(check?.order.tableId ?? undefined);
    return { ok: true, message: "Producto agregado.", id: item.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo agregar.",
    };
  }
}

export async function updateItemQtyAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = updateQtySchema.parse(raw);
    await orderService.updateItemQuantity(data);
    revalidatePos();
    return { ok: true, message: "Cantidad actualizada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function removeOrderItemAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = itemIdSchema.parse(raw);
    await orderService.removeItem(data);
    revalidatePos();
    return { ok: true, message: "Producto eliminado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar.",
    };
  }
}

export async function sendToKitchenAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("orders", "update");
    const data = sendKitchenSchema.parse(raw);
    const count = await orderService.sendCheckToKitchen(data);
    revalidatePos();
    return { ok: true, message: `${count} producto(s) enviados a cocina.`, count };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo enviar.",
    };
  }
}

export async function updateKitchenStatusAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("kitchen", "update");
    const data = kitchenStatusSchema.parse(raw);
    await orderService.updateKitchenItemStatus(data);
    revalidatePos();
    return { ok: true, message: "Estado actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function moveItemsAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("checks", "update");
    const data = moveItemsSchema.parse(raw);
    await orderService.moveItemsToCheck(data);
    revalidatePos();
    return { ok: true, message: "Productos movidos." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo mover.",
    };
  }
}

export async function splitEqualAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("checks", "update");
    const data = splitEqualSchema.parse(raw);
    await orderService.splitEqualChecks(data);
    revalidatePos();
    return { ok: true, message: "Cuentas creadas para división." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo dividir.",
    };
  }
}

export async function splitCustomAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("checks", "update");
    const data = splitCustomSchema.parse(raw);
    await orderService.splitCustomAmountChecks(data);
    revalidatePos();
    return { ok: true, message: "Cuentas por monto creadas." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo dividir.",
    };
  }
}

export async function splitBySeatsAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("checks", "update");
    const data = splitBySeatsSchema.parse(raw);
    const result = await orderService.splitByConsumption(data);
    revalidatePos();
    return {
      ok: true,
      message: `Cuentas por consumo creadas (${result.checkCount}).`,
      count: result.checkCount,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo dividir.",
    };
  }
}

export async function addSeatAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = addSeatSchema.parse(raw);
    const seat = await orderService.addSeat(data.orderId);
    const order = await prisma.order.findUnique({ where: { id: data.orderId } });
    revalidatePos(order?.tableId ?? undefined);
    return { ok: true, message: "Persona agregada.", id: seat.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo agregar.",
    };
  }
}

export async function renameSeatAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = renameSeatSchema.parse(raw);
    const seat = await orderService.renameSeat(data);
    const order = await prisma.order.findUnique({ where: { id: seat.orderId } });
    revalidatePos(order?.tableId ?? undefined);
    return { ok: true, message: "Nombre actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo renombrar.",
    };
  }
}

export async function assignSeatAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = assignSeatSchema.parse(raw);
    const item = await orderService.assignItemSeat(data);
    const check = await prisma.check.findUnique({
      where: { id: item.checkId },
      include: { order: true },
    });
    revalidatePos(check?.order.tableId ?? undefined);
    return { ok: true, message: "Asignado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo asignar.",
    };
  }
}

export async function setTableStatusAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = tableStatusSchema.parse(raw);
    await orderService.setTableStatus(data);
    revalidatePos(data.tableId);
    return { ok: true, message: "Estado de mesa actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function endTableSessionAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("pos", "update");
    const data = endSessionSchema.parse(raw);
    await orderService.endTableSession(data);
    revalidatePos();
    return { ok: true, message: "Sesión de mesa finalizada." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo finalizar.",
    };
  }
}
