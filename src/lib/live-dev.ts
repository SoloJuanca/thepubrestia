import { createRequire } from "node:module";
import type { WebSocketServer } from "ws";

const require = createRequire(import.meta.url);
const globalLive = globalThis as { liveWss?: WebSocketServer };

/** Dev-only socket server. Next.js route upgrades only exist on Vercel. */
export function startDevLiveSocket() {
  if (globalLive.liveWss) return;
  const { WebSocketServer } = require("ws") as typeof import("ws");
  const wss = new WebSocketServer({ port: 3001 });
  globalLive.liveWss = wss;
  wss.on("connection", (ws) => {
    void import("@/lib/live").then(({ pushLiveChanges }) =>
      pushLiveChanges(
        (payload) => {
          if (ws.readyState === 1) ws.send(payload);
        },
        () => ws.readyState !== 1,
      ),
    );
  });
  wss.on("error", (error) => {
    console.error("[live] dev socket", error);
  });
}

export function broadcastLive() {
  const wss = globalLive.liveWss;
  if (!wss) return;
  const payload = JSON.stringify({ type: "pos" });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}
