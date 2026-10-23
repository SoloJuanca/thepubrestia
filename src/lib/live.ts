import { prisma } from "@/lib/prisma";
import { broadcastLive } from "@/lib/live-dev";

/** Notify every open kitchen/POS socket that orders changed. */
export async function publishLive() {
  try {
    await prisma.liveSignal.upsert({
      where: { id: "pos" },
      create: { id: "pos", version: 1 },
      update: { version: { increment: 1 } },
    });
  } catch (error) {
    console.error("[live] no se pudo publicar", error);
  }
  broadcastLive();
}

export async function readLiveVersion() {
  const row = await prisma.liveSignal.findUnique({ where: { id: "pos" } });
  return row?.version ?? 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Each socket watches the shared version and pushes only when it changes. */
export async function pushLiveChanges(
  send: (payload: string) => void,
  isClosed: () => boolean,
) {
  let version = 0;
  try {
    version = await readLiveVersion();
  } catch (error) {
    console.error("[live] lectura", error);
  }

  while (!isClosed()) {
    await sleep(800);
    if (isClosed()) break;
    try {
      const next = await readLiveVersion();
      if (next !== version) {
        version = next;
        send(JSON.stringify({ type: "pos" }));
      }
    } catch (error) {
      console.error("[live] lectura", error);
    }
  }
}
