"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { paymentService } from "@/services/payment.service";
import { dailyCloseService } from "@/services/daily-close.service";
import { closeCheckSchema, dailyCloseSchema } from "@/validations/payment";

export type ActionResult =
  | {
      ok: true;
      message?: string;
      checkId?: string;
      allClosed?: boolean;
      tableId?: string | null;
    }
  | { ok: false; error: string };

function revalidatePay(tableId?: string | null) {
  revalidatePath("/pos");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/daily-close");
  if (tableId) revalidatePath(`/pos/tables/${tableId}`);
}

export async function closeCheckAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("checks", "close");
    await assertPermission("payments", "create");
    const data = closeCheckSchema.parse(raw);

    const result = await paymentService.closeCheck({
      checkId: data.checkId,
      payments: data.payments,
      paidById: user.id,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CHECK_CLOSE",
        entity: "Check",
        entityId: data.checkId,
        after: {
          payments: data.payments,
          paymentSum: result.paymentSum,
          tipSum: result.tipSum,
        },
      },
    });

    revalidatePay(result.tableId);
    return {
      ok: true,
      message: result.allClosed
        ? "Cuenta cobrada. Orden cerrada."
        : "Cuenta cobrada.",
      checkId: result.checkId,
      allClosed: result.allClosed,
      tableId: result.tableId,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo cobrar.",
    };
  }
}

export async function confirmDailyCloseAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("daily_close", "create");
    const data = dailyCloseSchema.parse(raw);

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
    });
    const location =
      (profile?.locationId
        ? await prisma.location.findUnique({ where: { id: profile.locationId } })
        : null) ??
      (await prisma.location.findFirst({
        where: { active: true },
        orderBy: { createdAt: "asc" },
      }));
    if (!location) return { ok: false, error: "Sin sucursal." };

    const [y, m, d] = data.businessDate.split("-").map(Number);
    const businessDate = new Date(Date.UTC(y, m - 1, d));
    const close = await dailyCloseService.confirm({
      locationId: location.id,
      businessDate,
      closedById: user.id,
      notes: data.notes,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DAILY_CLOSE",
        entity: "DailyClose",
        entityId: close.id,
        after: {
          businessDate: data.businessDate,
          salesTotal: Number(close.salesTotal),
        },
      },
    });

    revalidatePay();
    return { ok: true, message: "Cierre de día confirmado." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo cerrar el día.",
    };
  }
}
