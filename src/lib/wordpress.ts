export class WordpressError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "WordpressError";
    this.status = status;
  }
}

export type WordpressCustomer = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
};

function siteUrl() {
  return process.env.WORDPRESS_URL?.trim().replace(/\/$/, "") ?? "";
}

export function wordpressBridgeConfigured() {
  return Boolean(siteUrl() && process.env.WORDPRESS_BRIDGE_SECRET?.trim());
}

export function wooCommerceConfigured() {
  return Boolean(
    siteUrl() &&
      process.env.WOOCOMMERCE_CONSUMER_KEY?.trim() &&
      process.env.WOOCOMMERCE_CONSUMER_SECRET?.trim(),
  );
}

function timeoutSignal() {
  return AbortSignal.timeout(12_000);
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    // HTML or empty body from a proxy.
  }
  return fallback;
}

export async function bridgePost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!wordpressBridgeConfigured()) {
    throw new WordpressError(
      "La tienda en línea no está conectada todavía.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${siteUrl()}/wp-json/thepub/v1${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Thepub-Secret": process.env.WORDPRESS_BRIDGE_SECRET!.trim(),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: timeoutSignal(),
    });
  } catch (error) {
    console.error("[wordpress] bridge", error);
    throw new WordpressError(
      "No se pudo conectar con WordPress. Intenta de nuevo.",
      502,
    );
  }

  if (!response.ok) {
    throw new WordpressError(
      await readErrorMessage(response, "WordPress rechazó la solicitud."),
      response.status,
    );
  }

  return (await response.json()) as T;
}

export async function wooRequest<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  if (!wooCommerceConfigured()) {
    throw new WordpressError("WooCommerce no está configurado.", 503);
  }

  const key = process.env.WOOCOMMERCE_CONSUMER_KEY!.trim();
  const secret = process.env.WOOCOMMERCE_CONSUMER_SECRET!.trim();
  const authorization = `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;

  let response: Response;
  try {
    response = await fetch(`${siteUrl()}/wp-json/wc/v3${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: timeoutSignal(),
    });
  } catch (error) {
    console.error("[wordpress] woo", error);
    throw new WordpressError(
      "No se pudo conectar con WooCommerce. Intenta de nuevo.",
      502,
    );
  }

  if (!response.ok) {
    throw new WordpressError(
      await readErrorMessage(response, "WooCommerce rechazó la solicitud."),
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function parseWordpressCustomer(raw: unknown): WordpressCustomer {
  if (!raw || typeof raw !== "object") {
    throw new WordpressError("Respuesta inválida de WordPress.");
  }
  const row = raw as Record<string, unknown>;
  const id = Number(row.id);
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const phone = typeof row.phone === "string" ? row.phone.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !email.includes("@")) {
    throw new WordpressError("Respuesta inválida de WordPress.");
  }
  return { id, email, name, phone: phone || null };
}
