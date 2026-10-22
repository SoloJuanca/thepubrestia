"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openTakeoutAction } from "@/features/pos/actions";
import { TABLE_STATUS_LABELS } from "@/lib/pos-labels";

export type TakeoutCard = {
  id: string;
  guestName: string;
  ticketNumber: number | null;
  openMinutes: number;
  total: string;
  waiterName: string | null;
  unpaidCount: number;
  status: string;
};

type Props = {
  orders: TakeoutCard[];
};

export function TakeoutBoard({ orders }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function createOrder(event: React.FormEvent) {
    event.preventDefault();
    const guestName = name.trim();
    if (!guestName) {
      toast.error("Escribe el nombre");
      return;
    }
    startTransition(async () => {
      const result = await openTakeoutAction({ guestName });
      if (!result.ok || !result.id) {
        toast.error(result.ok ? "No se pudo abrir el pedido." : result.error);
        return;
      }
      setName("");
      toast.success(`Pedido de ${guestName}`);
      router.push(`/takeout/${result.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Para llevar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Abre un pedido con el nombre de quien lo recoge
          </p>
        </div>
        <Link
          href="/pos"
          className="text-sm font-medium text-[var(--pub-blue)] hover:underline"
        >
          Ver mesas
        </Link>
      </div>

      <form
        onSubmit={createOrder}
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="guestName">Nombre</Label>
          <Input
            id="guestName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Ana"
            maxLength={80}
            autoComplete="off"
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Abriendo…" : "Nuevo pedido"}
        </Button>
      </form>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay pedidos para llevar abiertos.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/takeout/${order.id}`}
              className="flex min-h-[104px] flex-col justify-between rounded-xl border-2 border-[var(--pub-blue)] bg-surface p-3 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold tracking-tight">
                    {order.guestName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Para llevar
                    {order.ticketNumber != null ? ` · #${order.ticketNumber}` : ""}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {order.unpaidCount > 0
                    ? TABLE_STATUS_LABELS.AWAITING_PAYMENT
                    : "Abierta"}
                </Badge>
              </div>
              <div className="mt-2 text-xs">
                <p className="font-medium">${order.total}</p>
                <p className="text-muted-foreground">
                  {order.openMinutes} min
                  {order.waiterName ? ` · ${order.waiterName}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
