import type { WebSocket } from "ws";
import { auth } from "@/lib/auth";
import { pushLiveChanges } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Upgrade = (
  handler: (ws: WebSocket) => void | Promise<void>,
) => Promise<Response>;

async function loadUpgrade(): Promise<Upgrade | null> {
  try {
    const mod = (await import("@vercel/functions")) as {
      upgradeWebSocket?: Upgrade;
      experimental_upgradeWebSocket?: Upgrade;
    };
    return mod.upgradeWebSocket ?? mod.experimental_upgradeWebSocket ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("No autorizado", { status: 401 });
  }

  const upgrade = await loadUpgrade();
  if (!upgrade) {
    return Response.json(
      { ok: false, error: "WebSocket solo está disponible en Vercel." },
      { status: 501 },
    );
  }

  return upgrade(async (ws) => {
    ws.on("error", () => undefined);
    await pushLiveChanges(
      (payload) => ws.send(payload),
      () => ws.readyState !== ws.OPEN,
    );
  });
}
