import { PrismaClient } from "@prisma/client";

/**
 * On Vercel, Neon often injects STORAGE_DATABASE_URL (custom prefix).
 * Prefer that on Vercel so we don't silently use a mismatched manual DATABASE_URL.
 * Locally, prefer DATABASE_URL, then fall back to STORAGE_DATABASE_URL.
 * For pooled Neon hosts, enable pgbouncer mode for serverless.
 */
function resolveDatabaseUrl(): string | undefined {
  const database = process.env.DATABASE_URL?.trim();
  const storage = process.env.STORAGE_DATABASE_URL?.trim();
  const raw = process.env.VERCEL
    ? storage || database
    : database || storage;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (
      url.hostname.includes("-pooler.") &&
      !url.searchParams.has("pgbouncer")
    ) {
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const resolved = resolveDatabaseUrl();
if (resolved) {
  process.env.DATABASE_URL = resolved;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function databaseHostHint(): string | null {
  const resolved = resolveDatabaseUrl();
  if (!resolved) return null;
  try {
    return new URL(resolved).hostname;
  } catch {
    return null;
  }
}
