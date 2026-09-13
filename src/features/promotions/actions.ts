"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { promotionService } from "@/services/promotion.service";
import {
  applyPromoSchema,
  createPromotionSchema,
  removePromoSchema,
  updatePromotionSchema,
} from "@/validations/crm-finance";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function revalidatePromos() {
  revalidatePath("/promotions");
  revalidatePath("/customers");
  revalidatePath("/pos");
}

function emptyToNull(v?: string | null) {
  if (v == null || v === "") return null;
  return v;
}

export async function createPromotionAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("promotions", "create");
    const data = createPromotionSchema.parse(raw);
    const promo = await prisma.promotion.create({
      data: {
        locationId: data.locationId,
        name: data.name.trim(),
        description: emptyToNull(data.description),
        code: data.code.trim().toUpperCase(),
        type: data.type,
        amount: data.amount,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        active: data.active,
        totalLimit: data.totalLimit ?? null,
        perCustomerLimit: data.perCustomerLimit ?? null,
        stackable: data.stackable,
        appliesToEntireCheck: data.appliesToEntireCheck,
        products: data.menuItemIds.length
          ? { create: data.menuItemIds.map((menuItemId) => ({ menuItemId })) }
          : undefined,
        categories: data.categoryIds.length
          ? { create: data.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PROMO_CREATE",
        entity: "Promotion",
        entityId: promo.id,
        after: { code: promo.code },
      },
    });
    revalidatePromos();
    return { ok: true, message: "Promoción creada.", id: promo.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear.",
    };
  }
}

export async function updatePromotionAction(raw: unknown): Promise<ActionResult> {
  try {
    await assertPermission("promotions", "update");
    const data = updatePromotionSchema.parse(raw);
    const existing = await prisma.promotion.findUnique({ where: { id: data.id } });
    if (!existing) return { ok: false, error: "Promoción no encontrada." };

    await prisma.$transaction(async (tx) => {
      await tx.promotion.update({
        where: { id: data.id },
        data: {
          name: data.name?.trim(),
          description:
            data.description === undefined
              ? undefined
              : emptyToNull(data.description),
          code: data.code?.trim().toUpperCase(),
          type: data.type,
          amount: data.amount,
          startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
          endsAt:
            data.endsAt === undefined
              ? undefined
              : data.endsAt
                ? new Date(data.endsAt)
                : null,
          active: data.active,
          totalLimit: data.totalLimit === undefined ? undefined : data.totalLimit,
          perCustomerLimit:
            data.perCustomerLimit === undefined
              ? undefined
              : data.perCustomerLimit,
          stackable: data.stackable,
          appliesToEntireCheck: data.appliesToEntireCheck,
        },
      });
      if (data.menuItemIds) {
        await tx.promotionProduct.deleteMany({ where: { promotionId: data.id } });
        if (data.menuItemIds.length) {
          await tx.promotionProduct.createMany({
            data: data.menuItemIds.map((menuItemId) => ({
              promotionId: data.id,
              menuItemId,
            })),
          });
        }
      }
      if (data.categoryIds) {
        await tx.promotionCategory.deleteMany({
          where: { promotionId: data.id },
        });
        if (data.categoryIds.length) {
          await tx.promotionCategory.createMany({
            data: data.categoryIds.map((categoryId) => ({
              promotionId: data.id,
              categoryId,
            })),
          });
        }
      }
    });

    revalidatePromos();
    return { ok: true, message: "Promoción actualizada." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function applyPromoToCheckAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("promotions", "apply");
    const data = applyPromoSchema.parse(raw);
    await promotionService.applyToCheck(data);
    revalidatePromos();
    revalidatePath("/pos");
    return { ok: true, message: "Promoción aplicada." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo aplicar.",
    };
  }
}

export async function removePromoFromCheckAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    await assertPermission("promotions", "apply");
    const data = removePromoSchema.parse(raw);
    await promotionService.removeFromCheck(data.checkId);
    revalidatePromos();
    revalidatePath("/pos");
    return { ok: true, message: "Promoción removida." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo remover.",
    };
  }
}
