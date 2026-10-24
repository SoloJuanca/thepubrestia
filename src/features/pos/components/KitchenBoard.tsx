"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateKitchenStatusAction } from "@/features/pos/actions";
import {
  enableKitchenSound,
  isKitchenSoundRunning,
  noteKitchenTickets,
  playKitchenChime,
} from "@/features/pos/kitchen-chime";
import { useLiveRefresh } from "@/features/pos/hooks/useLiveRefresh";

export type KitchenTicket = {
  orderItemId: string;
  tableName: string;
  checkName: string;
  itemName: string;
  quantity: number;
  modifiers: string[];
  notes: string | null;
  status: string;
  sentAt: string | null;
};

type Props = { tickets: KitchenTicket[] };

const NEXT: Record<string, "PREPARING" | "READY" | null> = {
  SENT_TO_KITCHEN: "PREPARING",
  PREPARING: "READY",
  READY: null,
};

const NEXT_LABEL: Record<string, string> = {
  PREPARING: "Preparar",
  READY: "Listo",
};

export function KitchenBoard({ tickets }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [soundReady, setSoundReady] = useState(false);
  const soundReadyRef = useRef(false);
  const pendingChime = useRef(false);
  useLiveRefresh();

  useEffect(() => {
    if (isKitchenSoundRunning()) {
      setSoundReady(true);
      soundReadyRef.current = true;
    }
  }, []);

  useEffect(() => {
    soundReadyRef.current = soundReady;
  }, [soundReady]);

  useEffect(() => {
    const arrived = noteKitchenTickets(tickets.map((ticket) => ticket.orderItemId));
    if (!arrived) return;
    if (soundReadyRef.current) {
      playKitchenChime();
      return;
    }
    pendingChime.current = true;
  }, [tickets]);

  function enableSound() {
    void enableKitchenSound().then((ok) => {
      if (!ok) {
        toast.error(
          "El navegador bloqueó el sonido. Toca el aviso e inténtalo de nuevo.",
        );
        return;
      }
      setSoundReady(true);
      soundReadyRef.current = true;
      pendingChime.current = false;
    });
  }

  const groups = {
    SENT_TO_KITCHEN: tickets.filter((t) => t.status === "SENT_TO_KITCHEN"),
    PREPARING: tickets.filter((t) => t.status === "PREPARING"),
    READY: tickets.filter((t) => t.status === "READY"),
  };

  function advance(ticket: KitchenTicket) {
    const next = NEXT[ticket.status];
    if (!next) return;
    startTransition(async () => {
      const result = await updateKitchenStatusAction({
        orderItemId: ticket.orderItemId,
        status: next,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    });
  }

  return (
    <div className="space-y-6">
      {!soundReady ? (
        <button
          type="button"
          onClick={enableSound}
          className="flex w-full items-center justify-between gap-4 rounded-xl bg-[var(--pub-blue)] px-4 py-4 text-left text-white shadow-sm transition-colors hover:bg-[var(--pub-blue-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span>
            <span className="block text-base font-semibold">
              Activa el sonido de cocina
            </span>
            <span className="mt-1 block text-sm text-white/90">
              Toca este aviso. Vas a escuchar una campana de prueba y otra cada vez que entre un pedido.
            </span>
          </span>
          <Volume2 className="size-8 shrink-0" aria-hidden />
        </button>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Cocina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            En vivo. El mesero marca entregado cuando lo lleva.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {soundReady ? (
            <Button variant="secondary" className="min-h-11" type="button" disabled>
              <Volume2 />
              Sonido activo
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => router.refresh()}
          >
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <KitchenColumn
          title="Nuevos"
          tickets={groups.SENT_TO_KITCHEN}
          pending={pending}
          onAdvance={advance}
        />
        <KitchenColumn
          title="Preparando"
          tickets={groups.PREPARING}
          pending={pending}
          onAdvance={advance}
        />
        <KitchenColumn
          title="Listos"
          tickets={groups.READY}
          pending={pending}
          onAdvance={advance}
        />
      </div>
    </div>
  );
}

function KitchenColumn({
  title,
  tickets,
  pending,
  onAdvance,
}: {
  title: string;
  tickets: KitchenTicket[];
  pending: boolean;
  onAdvance: (t: KitchenTicket) => void;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Badge variant="secondary">{tickets.length}</Badge>
      </div>
      {tickets.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nada aquí</p>
      ) : (
        tickets.map((ticket) => {
          const next = NEXT[ticket.status];
          return (
            <div
              key={ticket.orderItemId}
              className="rounded-xl border border-border/70 bg-card p-4"
            >
              <p className="text-xs text-muted-foreground">
                {ticket.tableName} · {ticket.checkName}
                {ticket.sentAt ? ` · ${ticket.sentAt}` : ""}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {ticket.quantity}× {ticket.itemName}
              </p>
              {ticket.modifiers.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {ticket.modifiers.join(", ")}
                </p>
              ) : null}
              {ticket.notes ? (
                <p className="text-sm text-amber-700">Nota: {ticket.notes}</p>
              ) : null}
              {next ? (
                <Button
                  className="mt-3 min-h-12 w-full text-base"
                  size="lg"
                  disabled={pending}
                  onClick={() => onAdvance(ticket)}
                >
                  {NEXT_LABEL[next]}
                </Button>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Listo para que el mesero lo entregue
                </p>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
