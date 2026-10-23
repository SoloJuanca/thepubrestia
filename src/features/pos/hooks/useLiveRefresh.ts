"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function socketUrl() {
  if (process.env.NODE_ENV === "development") {
    return `ws://${window.location.hostname}:3001`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/live`;
}

/** Refresh this screen when the server pushes a POS change over WebSocket. */
export function useLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectDelay = 1000;
    let stopped = false;
    let reconnectTimer = 0;
    let refreshTimer = 0;

    let openedOnce = false;

    function connect() {
      socket = new WebSocket(socketUrl());
      socket.addEventListener("open", () => {
        if (openedOnce) router.refresh();
        openedOnce = true;
        reconnectDelay = 1000;
      });
      socket.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(String(event.data)) as { type?: string };
          if (data.type !== "pos") return;
        } catch {
          return;
        }
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => router.refresh(), 120);
      });
      socket.addEventListener("close", () => {
        if (stopped) return;
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 15000);
      });
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(refreshTimer);
      socket?.close();
    };
  }, [router]);
}
