import { NextResponse } from "next/server";
import { databaseHostHint, prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public readiness probe for production auth/DB debugging.
 * Does not expose secrets or user data beyond existence flags.
 */
export async function GET() {
  const host = databaseHostHint();
  const storageHost = (() => {
    const raw = process.env.STORAGE_DATABASE_URL;
    if (!raw) return null;
    try {
      return new URL(raw).hostname;
    } catch {
      return null;
    }
  })();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const admin = await prisma.user.findUnique({
      where: { email: "admin@thepub.local" },
      select: { id: true, active: true, type: true, passwordHash: true },
    });

    const projectKey = (h: string | null) =>
      h ? h.replace("-pooler", "").split(".")[0] : null;
    const dbProject = projectKey(host);
    const storageProject = projectKey(storageHost);

    return NextResponse.json({
      ok: true,
      db: true,
      dbHost: host,
      storageHost,
      hostsMatch:
        !dbProject || !storageProject ? null : dbProject === storageProject,
      authSecret: Boolean(process.env.AUTH_SECRET),
      authUrl: process.env.AUTH_URL ?? null,
      adminExists: Boolean(admin),
      adminActive: admin?.active ?? false,
      adminEmployee: admin?.type === "EMPLOYEE",
      adminHasPassword: Boolean(admin?.passwordHash),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        db: false,
        dbHost: host,
        storageHost,
        authSecret: Boolean(process.env.AUTH_SECRET),
        authUrl: process.env.AUTH_URL ?? null,
        error: error instanceof Error ? error.name : "unknown",
      },
      { status: 503 },
    );
  }
}
