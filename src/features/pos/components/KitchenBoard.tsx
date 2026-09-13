"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateKitchenStatusAction } from "@/features/pos/actions";

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

const NEXT: Record<string, "PREPARING" | "READY" | "DELIVERED" | null> = {
  SENT_TO_KITCHEN: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
  DELIVERED: null,
};

const NEXT_LABEL: Record<string, string> = {
  PREPARING: "Preparar",
  READY: "Listo",
  DELIVERED: "Entregado",
};

export function KitchenBoard({ tickets }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Cocina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cola de preparación · toques grandes
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => router.refresh()}
        >
          Actualizar
        </Button>
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
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
}
