"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { reviewService } from "@/services/review.service";
import {
  mintReviewTokenSchema,
  submitReviewSchema,
} from "@/validations/crm-finance";

export type ActionResult =
  | { ok: true; message?: string; id?: string; token?: string; url?: string }
  | { ok: false; error: string };

export async function mintReviewTokenAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("reviews", "create");
    const data = mintReviewTokenSchema.parse(raw);
    const token = await reviewService.mintToken(data);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REVIEW_TOKEN",
        entity: "ReviewToken",
        entityId: token.id,
        after: { orderId: data.orderId ?? null },
      },
    });
    revalidatePath("/reviews");
    revalidatePath("/tickets");
    return {
      ok: true,
      message: "Token de reseña generado.",
      id: token.id,
      token: token.token,
      url: `/review/${token.token}`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo generar token.",
    };
  }
}

/** Public — no employee auth */
export async function submitPublicReviewAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const data = submitReviewSchema.parse(raw);
    const review = await reviewService.submit({
      ...data,
      guestEmail: data.guestEmail || null,
    });
    return { ok: true, message: "¡Gracias por tu reseña!", id: review.id };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo enviar.",
    };
  }
}
