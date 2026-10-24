"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { publishLive } from "@/lib/live";
import { getCurrentUser } from "@/lib/rbac";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WordpressError } from "@/lib/wordpress";
import { loginCustomerAccount, registerCustomerAccount } from "@/services/customer-account.service";
import { orderService } from "@/services/order.service";
import { mirrorWebOrder } from "@/services/wordpress.service";
import {
  customerLoginSchema,
  customerRegisterSchema,
  placeWebOrderSchema,
  safeCustomerPath,
} from "@/validations/store";

export type StoreActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function isRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
  );
}

function clientMessage(error: unknown, fallback: string) {
  if (error instanceof WordpressError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError) return fallback;
  if (
    error instanceof Error &&
    error.message.length > 0 &&
    error.message.length < 180 &&
    !error.message.includes("\n")
  ) {
    return error.message;
  }
  return fallback;
}

export async function loginCustomerAction(
  raw: unknown,
): Promise<StoreActionResult> {
  const parsed = customerLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa los datos.",
    };
  }

  try {
    await loginCustomerAccount(parsed.data.email, parsed.data.password);
    await signIn("customer", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCustomerPath(parsed.data.callbackUrl),
    });
    return { ok: true };
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (!(error instanceof WordpressError)) console.error("[store] login", error);
    return { ok: false, error: clientMessage(error, "No se pudo entrar.") };
  }
}

export async function registerCustomerAction(
  raw: unknown,
): Promise<StoreActionResult> {
  const parsed = customerRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa los datos.",
    };
  }

  try {
    await registerCustomerAccount({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
    });
    await signIn("customer", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/pedir",
    });
    return { ok: true };
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (!(error instanceof WordpressError)) {
      console.error("[store] register", error);
    }
    return {
      ok: false,
      error: clientMessage(error, "No se pudo crear la cuenta."),
    };
  }
}

export async function placeWebOrderAction(
  raw: unknown,
): Promise<StoreActionResult> {
  const user = await getCurrentUser();
  if (!user || user.type !== "CUSTOMER" || !user.customerProfile) {
    return { ok: false, error: "Entra con tu cuenta para pedir." };
  }

  const parsed = placeWebOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa el pedido.",
    };
  }

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) return { ok: false, error: "No hay sucursal activa." };

  try {
    const order = await orderService.placeWebOrder({
      locationId: location.id,
      guestName: (user.name || user.email.split("@")[0]).slice(0, 80),
      customerId: user.customerProfile.id,
      notes: parsed.data.note,
      lines: parsed.data.lines,
    });

    await mirrorWebOrder(order.id);
    revalidatePath("/takeout");
    revalidatePath("/kitchen");
    revalidatePath("/orders");
    revalidatePath("/cuenta/pedidos");
    void publishLive();

    return {
      ok: true,
      id: order.id,
      message: "Pedido enviado a cocina. Pagas al recoger.",
    };
  } catch (error) {
    console.error("[store] place order", error);
    return {
      ok: false,
      error: clientMessage(error, "No se pudo enviar el pedido."),
    };
  }
}
