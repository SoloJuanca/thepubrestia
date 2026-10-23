"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adjustStockAction,
  markLotTodayAction,
} from "@/features/inventory/actions";
import type { IngredientRow } from "@/features/inventory/components/IngredientsPanel";
import { UNIT_LABELS } from "@/features/inventory/labels";
import {
  daysOnHand,
  formatQty,
  isOlderThan,
  isPrepared,
  PERISHABLE_MAX_DAYS,
  PREP_MAX_DAYS,
} from "@/features/inventory/stock-rules";
import type { AgeAlert } from "@/services/inventory.service";
import { cn } from "@/lib/utils";

type Props = {
  ingredients: IngredientRow[];
  canAdjust: boolean;
  stalePrepared: AgeAlert[];
  stalePerishable: AgeAlert[];
  lowCount: number;
  outCount: number;
};

function stockTone(row: IngredientRow) {
  const stock = Number(row.currentStock);
  const min = Number(row.minimumStock);
  if (stock <= 0) return "AGOTADO" as const;
  if (min > 0 && stock < min) return "BAJO" as const;
  return "OK" as const;
}

export function StockBoard({
  ingredients,
  canAdjust,
  stalePrepared,
  stalePerishable,
  lowCount,
  outCount,
}: Props) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const active = ingredients.filter((row) => row.active);
  const visible = needle
    ? active.filter((row) => row.name.toLowerCase().includes(needle))
    : active;
  const insumos = visible.filter((row) => !isPrepared(row.kind));
  const preparados = visible.filter((row) => isPrepared(row.kind));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <AlertChip label="Bajo" count={lowCount} />
        <AlertChip label="Agotado" count={outCount} />
        <AlertChip
          label={`Preparado +${PREP_MAX_DAYS} días`}
          count={stalePrepared.length}
        />
        <AlertChip
          label={`Perecedero +${PERISHABLE_MAX_DAYS} días`}
          count={stalePerishable.length}
        />
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar insumo o preparado"
        aria-label="Buscar en inventario"
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <StockColumn
          title="Insumos"
          description="Lo que se compra. Verdura, fruta y carne avisan si llevan más de 5 días."
          rows={insumos}
          canAdjust={canAdjust}
          empty="No hay insumos con ese nombre."
        />
        <StockColumn
          title="Preparados"
          description="Lo que ya se elaboró en cocina. Avisa si lleva más de 3 días."
          rows={preparados}
          canAdjust={canAdjust}
          empty="No hay preparados. Márcalo así al crearlo en el catálogo."
        />
      </div>
    </div>
  );
}

function AlertChip({ label, count }: { label: string; count: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
        count > 0
          ? "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-border text-muted-foreground",
      )}
    >
      <span className="font-semibold tabular-nums">{count}</span>
      {label}
    </span>
  );
}

function StockColumn({
  title,
  description,
  rows,
  canAdjust,
  empty,
}: {
  title: string;
  description: string;
  rows: IngredientRow[];
  canAdjust: boolean;
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <StockLine key={row.id} row={row} canAdjust={canAdjust} />
          ))}
        </ul>
      )}
    </section>
  );
}

function StockLine({
  row,
  canAdjust,
}: {
  row: IngredientRow;
  canAdjust: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(row.currentStock);

  useEffect(() => {
    setQty(row.currentStock);
  }, [row.currentStock]);
  const unit = UNIT_LABELS[row.baseUnit] ?? row.baseUnit;
  const tone = stockTone(row);
  const prepared = isPrepared(row.kind);
  const watched = prepared || row.perishable;
  const limit = prepared ? PREP_MAX_DAYS : PERISHABLE_MAX_DAYS;
  const days = daysOnHand(row.stockedAt);
  const stale =
    Number(row.currentStock) > 0 &&
    watched &&
    isOlderThan(row.stockedAt, limit);

  function saveCount() {
    const next = Number(qty);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Escribe una cantidad válida.");
      return;
    }
    if (next === Number(row.currentStock)) return;
    startTransition(async () => {
      const result = await adjustStockAction({
        ingredientId: row.id,
        mode: "absolute",
        quantity: next,
        notes: "Conteo en inventario",
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(`${row.name}: ${formatQty(next)} ${unit}`);
    });
  }

  function markToday() {
    startTransition(async () => {
      const result = await markLotTodayAction({ ingredientId: row.id });
      if (!result.ok) toast.error(result.error);
      else toast.success(prepared ? "Se preparó hoy." : "Llegó hoy.");
    });
  }

  return (
    <li className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/inventory/${row.id}`}
            className="font-medium hover:underline"
          >
            {row.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {formatQty(row.currentStock)} {unit}
            {Number(row.minimumStock) > 0
              ? ` · mínimo ${formatQty(row.minimumStock)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tone !== "OK" ? (
            <Badge variant={tone === "AGOTADO" ? "destructive" : "secondary"}>
              {tone === "AGOTADO" ? "Agotado" : "Bajo"}
            </Badge>
          ) : null}
          {row.perishable && !prepared ? (
            <Badge variant="outline">Perecedero</Badge>
          ) : null}
          {stale && days != null ? (
            <Badge variant="destructive">Hace {days} días</Badge>
          ) : watched && days != null && Number(row.currentStock) > 0 ? (
            <Badge variant="outline">Hace {days} días</Badge>
          ) : watched && Number(row.currentStock) > 0 && !row.stockedAt ? (
            <Badge variant="secondary">Sin fecha</Badge>
          ) : null}
        </div>
      </div>
      {canAdjust ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={0}
            step="any"
            value={qty}
            aria-label={`Cantidad de ${row.name}`}
            onChange={(event) => setQty(event.target.value)}
            className="h-9 w-28"
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={saveCount}
          >
            Guardar conteo
          </Button>
          {watched && Number(row.currentStock) > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={markToday}
            >
              {prepared ? "Se preparó hoy" : "Llegó hoy"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
