import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  bridgePost,
  parseWordpressCustomer,
  wooCommerceConfigured,
  wooRequest,
  WordpressError,
  type WordpressCustomer,
} from "@/lib/wordpress";

const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 8;

function money(value: Prisma.Decimal | number | string) {
  return Number(value).toFixed(2);
}

async function rememberAuthFailure(email: string) {
  await prisma.auditLog.create({
    data: {
      action: "CUSTOMER_AUTH_FAIL",
      entity: "CustomerAuth",
      entityId: email,
    },
  });
}

async function assertLoginAllowed(email: string) {
  const since = new Date(Date.now() - FAIL_WINDOW_MS);
  const recent = await prisma.auditLog.count({
    where: {
      action: "CUSTOMER_AUTH_FAIL",
      entity: "CustomerAuth",
      entityId: email,
      createdAt: { gte: since },
    },
  });
  if (recent >= MAX_LOGIN_FAILURES) {
    throw new WordpressError(
      "Demasiados intentos. Espera unos minutos.",
      429,
    );
  }
}

export async function loginWithWordpress(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  await assertLoginAllowed(normalized);
  try {
    const raw = await bridgePost<unknown>("/login", {
      email: normalized,
      password,
    });
    return parseWordpressCustomer(raw);
  } catch (error) {
    if (error instanceof WordpressError && error.status === 401) {
      await rememberAuthFailure(normalized);
    }
    throw error;
  }
}

export async function registerWithWordpress(params: {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
}) {
  const raw = await bridgePost<unknown>("/register", {
    email: params.email.trim().toLowerCase(),
    password: params.password,
    name: params.name.trim(),
    phone: params.phone?.trim() || "",
  });
  return parseWordpressCustomer(raw);
}

async function setSyncError(orderId: string, message: string | null) {
  await prisma.order.update({
    where: { id: orderId },
    data: { wcSyncError: message },
  });
}

type MirroredOrder = {
  id: string;
  status: string;
  source: "POS" | "WEB";
  wcOrderId: number | null;
  ticketNumber: number | null;
  guestName: string | null;
  notes: string | null;
  checks: Array<{
    total: Prisma.Decimal;
    customer: {
      wpUserId: number | null;
      phone: string | null;
      user: { email: string; name: string | null };
    } | null;
    items: Array<{
      nameSnapshot: string;
      quantity: number;
      lineTotal: Prisma.Decimal;
      notes: string | null;
      menuItem: { wcProductId: number | null; sku: string | null } | null;
      modifiers: Array<{ nameSnapshot: string }>;
    }>;
  }>;
};

function loadOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      checks: {
        include: {
          customer: { include: { user: true } },
          items: {
            where: { status: { not: "CANCELLED" } },
            include: {
              modifiers: true,
              menuItem: { select: { wcProductId: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

function wooPayload(order: MirroredOrder) {
  const check = order.checks[0];
  const customer = check?.customer;
  const [firstName, ...rest] = (order.guestName || customer?.user.name || "Cliente")
    .trim()
    .split(/\s+/);
  const lineItems = (check?.items ?? []).map((item) => {
    const modifiers = item.modifiers.map((modifier) => modifier.nameSnapshot);
    const meta: Array<{ key: string; value: string }> = [];
    if (modifiers.length) {
      meta.push({ key: "Modificadores", value: modifiers.join(", ") });
    }
    if (item.notes) meta.push({ key: "Nota", value: item.notes });
    return {
      ...(item.menuItem?.wcProductId
        ? { product_id: item.menuItem.wcProductId }
        : {}),
      ...(item.menuItem?.sku ? { sku: item.menuItem.sku } : {}),
      name: item.nameSnapshot,
      quantity: item.quantity,
      subtotal: money(item.lineTotal),
      total: money(item.lineTotal),
      meta_data: meta,
    };
  });

  const closed = order.status === "CLOSED";
  return {
    status: closed ? "completed" : "on-hold",
    set_paid: closed,
    payment_method: "pay_at_store",
    payment_method_title: "Pagar en tienda",
    ...(customer?.wpUserId ? { customer_id: customer.wpUserId } : {}),
    customer_note: order.notes ?? "Pedido en línea. Pagar al recoger.",
    billing: {
      first_name: firstName || "Cliente",
      last_name: rest.join(" "),
      email: customer?.user.email,
      phone: customer?.phone ?? "",
    },
    line_items: lineItems,
    meta_data: [
      { key: "_thepub_order_id", value: order.id },
      { key: "_thepub_ticket", value: String(order.ticketNumber ?? "") },
      { key: "_thepub_source", value: "web" },
    ],
  };
}

/** Creates the WooCommerce copy when this web order does not have one yet. */
export async function mirrorWebOrder(orderId: string) {
  if (!wooCommerceConfigured()) return;

  const order = await loadOrder(orderId);
  if (!order || order.source !== "WEB" || order.status === "CANCELLED") return;
  if (order.wcOrderId) return;
  if (!order.checks[0]?.items.length) return;

  try {
    let created: { id: number };
    try {
      created = await wooRequest<{ id: number }>("/orders", {
        method: "POST",
        body: wooPayload(order),
      });
    } catch (error) {
      if (!(error instanceof WordpressError) || !order.checks[0]?.customer?.wpUserId) {
        throw error;
      }
      const payload = wooPayload(order);
      delete payload.customer_id;
      created = await wooRequest<{ id: number }>("/orders", {
        method: "POST",
        body: payload,
      });
    }

    if (!created?.id) {
      throw new WordpressError("WooCommerce no devolvió el pedido.");
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { wcOrderId: created.id, wcSyncError: null },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo copiar el pedido.";
    console.error("[wordpress] mirror order", orderId, error);
    await setSyncError(orderId, message);
  }
}

export async function markWebOrderPaid(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, source: true, status: true, wcOrderId: true },
  });
  if (!order || order.source !== "WEB") return;
  if (!wooCommerceConfigured()) {
    await setSyncError(orderId, "WooCommerce no está configurado.");
    return;
  }

  if (!order.wcOrderId) await mirrorWebOrder(orderId);

  const fresh = await prisma.order.findUnique({
    where: { id: orderId },
    select: { wcOrderId: true },
  });
  if (!fresh?.wcOrderId) return;

  try {
    await wooRequest(`/orders/${fresh.wcOrderId}`, {
      method: "PUT",
      body: { status: "completed", set_paid: true },
    });
    await setSyncError(orderId, null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo completar en la tienda.";
    console.error("[wordpress] complete order", orderId, error);
    await setSyncError(orderId, message);
  }
}

export async function cancelWebOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, source: true, wcOrderId: true },
  });
  if (!order || order.source !== "WEB") return;
  if (!order.wcOrderId) {
    await setSyncError(orderId, null);
    return;
  }
  if (!wooCommerceConfigured()) {
    await setSyncError(orderId, "WooCommerce no está configurado.");
    return;
  }

  try {
    await wooRequest(`/orders/${order.wcOrderId}`, {
      method: "PUT",
      body: { status: "cancelled" },
    });
    await setSyncError(orderId, null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cancelar en la tienda.";
    console.error("[wordpress] cancel order", orderId, error);
    await setSyncError(orderId, message);
  }
}

type WooProduct = { id: number; sku?: string };

async function findProductBySku(sku: string) {
  const rows = await wooRequest<WooProduct[]>(
    `/products?sku=${encodeURIComponent(sku)}&per_page=1`,
  );
  return Array.isArray(rows) ? rows[0] : undefined;
}

/** Pushes name, price, and availability. Stock and recipes stay in this system. */
export async function syncMenuItemToStore(menuItemId: string): Promise<string | null> {
  if (!wooCommerceConfigured()) return null;

  const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!item) return null;

  try {
    if (!item.sku) {
      if (item.wcProductId) {
        await wooRequest(`/products/${item.wcProductId}`, {
          method: "PUT",
          body: { status: "draft", catalog_visibility: "hidden" },
        });
      }
      return null;
    }

    const visible = item.active && item.available;
    const payload = {
      name: item.name,
      sku: item.sku,
      type: "simple",
      regular_price: money(item.price),
      description: item.description ?? "",
      short_description: item.description ?? "",
      status: visible ? "publish" : "draft",
      catalog_visibility: visible ? "visible" : "hidden",
    };

    let productId = item.wcProductId;
    if (!productId) {
      productId = (await findProductBySku(item.sku))?.id ?? null;
    }

    if (productId) {
      const owner = await prisma.menuItem.findFirst({
        where: { wcProductId: productId, NOT: { id: item.id } },
        select: { id: true },
      });
      if (owner) {
        return "No se publicó en la tienda: ese SKU ya está ligado a otro producto.";
      }
      await wooRequest(`/products/${productId}`, {
        method: "PUT",
        body: payload,
      });
    } else {
      const created = await wooRequest<WooProduct>("/products", {
        method: "POST",
        body: { ...payload, manage_stock: false },
      });
      productId = created.id;
    }

    if (productId && productId !== item.wcProductId) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { wcProductId: productId },
      });
    }
    return null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "error desconocido";
    console.error("[wordpress] menu sync", menuItemId, error);
    return `No se publicó en la tienda: ${message}`;
  }
}

/** Retries copies that failed so kitchen staff are not blocked on WordPress. */
export async function retryWebOrderSync(locationId: string) {
  if (!wooCommerceConfigured()) return;

  const orders = await prisma.order.findMany({
    where: {
      locationId,
      source: "WEB",
      OR: [
        { wcOrderId: null, status: { not: "CANCELLED" } },
        { wcSyncError: { not: null } },
      ],
    },
    select: { id: true, status: true },
    take: 5,
    orderBy: { openedAt: "asc" },
  });

  for (const order of orders) {
    if (order.status === "CANCELLED") await cancelWebOrder(order.id);
    else if (order.status === "CLOSED") await markWebOrderPaid(order.id);
    else await mirrorWebOrder(order.id);
  }
}

export type { WordpressCustomer };
