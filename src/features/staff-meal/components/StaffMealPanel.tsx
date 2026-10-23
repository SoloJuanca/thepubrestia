"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  orderEmployeeMealAction,
  setEmployeeMealAction,
} from "@/features/staff-meal/actions";
import { useLiveRefresh } from "@/features/pos/hooks/useLiveRefresh";

type OrderRow = { id: string; name: string; status: string };

type Props = {
  dateLabel: string;
  canEdit: boolean;
  meal: { name: string; notes: string | null } | null;
  mine: { label: string } | null;
  orders: OrderRow[];
};

export function StaffMealPanel({
  dateLabel,
  canEdit,
  meal,
  mine,
  orders,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(meal?.name ?? "");
  const [notes, setNotes] = useState(meal?.notes ?? "");
  useLiveRefresh();

  useEffect(() => {
    setName(meal?.name ?? "");
    setNotes(meal?.notes ?? "");
  }, [meal?.name, meal?.notes]);

  function saveMeal() {
    startTransition(async () => {
      const result = await setEmployeeMealAction({
        name,
        notes: notes.trim() || null,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    });
  }

  function orderMine() {
    startTransition(async () => {
      const result = await orderEmployeeMealAction();
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Comida empleado
        </h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          {dateLabel}. Una comida del día, una comanda por empleado.
        </p>
      </div>

      {canEdit ? (
        <form
          className="space-y-3 rounded-xl border border-border bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveMeal();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="meal-name">Comida de hoy</Label>
            <Input
              id="meal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Milanesa con arroz"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meal-notes">Nota para cocina</Label>
            <Input
              id="meal-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <Button type="submit" disabled={pending}>
            Guardar comida del día
          </Button>
        </form>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-5">
        {meal ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Hoy se sirve
            </p>
            <h2 className="mt-1 text-xl font-semibold">{meal.name}</h2>
            {meal.notes ? (
              <p className="mt-1 text-sm text-muted-foreground">{meal.notes}</p>
            ) : null}
            <div className="mt-4">
              {mine ? (
                <Badge variant="secondary">Tu comida: {mine.label}</Badge>
              ) : (
                <Button type="button" disabled={pending} onClick={orderMine}>
                  Pedir mi comida
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Hoy todavía no hay comida de empleado.
          </p>
        )}
      </section>

      {canEdit ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">
            Pedidos de hoy ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie ha pedido.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {orders.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                >
                  <span>{row.name}</span>
                  <span className="text-muted-foreground">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
