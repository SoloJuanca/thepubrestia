"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setTableStatusAction } from "@/features/pos/actions";
import { OpenTableDrawer } from "@/features/pos/components/OpenTableDrawer";
import { TABLE_STATUS_LABELS } from "@/lib/pos-labels";

export type TableCardData = {
  id: string;
  name: string;
  capacity: number;
  status: string;
  openOrderId: string | null;
  openMinutes: number | null;
  checkTotal: string | null;
  waiterName: string | null;
  partySize: number | null;
  checkCount: number;
  unpaidCount: number;
};

type WaiterOption = { id: string; name: string };

type Props = {
  tables: TableCardData[];
  waiters: WaiterOption[];
  currentUserId: string;
};

/** Border-only status — never fill the whole card green/brown. */
const STATUS_BORDER: Record<string, string> = {
  AVAILABLE: "border-border bg-surface",
  OCCUPIED: "border-[var(--pub-blue)] bg-surface",
  AWAITING_PAYMENT: "border-[var(--warning)] bg-surface",
  RESERVED: "border-[var(--pub-blue-light)] bg-surface",
  CLEANING: "border-muted-foreground/40 bg-surface-secondary",
};

export function TablesGrid({ tables, waiters, currentUserId }: Props) {
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState<TableCardData | null>(null);

  function markAvailable(tableId: string) {
    startTransition(async () => {
      const result = await setTableStatusAction({
        tableId,
        status: "AVAILABLE",
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Mesa disponible");
    });
  }

  function displayStatus(table: TableCardData) {
    if (
      table.openOrderId &&
      table.unpaidCount > 0 &&
      table.status === "OCCUPIED" &&
      table.checkCount > 1
    ) {
      return "AWAITING_PAYMENT";
    }
    return table.status;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">POS / Mesas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toca una mesa libre para abrir · tablet first
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {tables.map((table) => {
          const status = displayStatus(table);
          const occupied = Boolean(table.openOrderId);
          const href = occupied ? `/pos/tables/${table.id}` : undefined;

          const card = (
            <div
              className={cn(
                "flex min-h-[112px] flex-col justify-between rounded-xl border-2 p-3 text-left transition-shadow hover:shadow-sm",
                STATUS_BORDER[status] ?? "border-border bg-surface",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold tracking-tight">
                    {table.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {table.capacity} lugares
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {TABLE_STATUS_LABELS[status] ?? status}
                </Badge>
              </div>

              {occupied ? (
                <div className="mt-2 space-y-0.5 text-xs">
                  <p className="font-medium">
                    {table.partySize ?? "—"} personas · $
                    {table.checkTotal ?? "0.00"}
                  </p>
                  <p className="text-muted-foreground">
                    {table.openMinutes != null
                      ? `${table.openMinutes} min`
                      : "—"}
                    {table.waiterName ? ` · ${table.waiterName}` : ""}
                  </p>
                </div>
              ) : table.status === "CLEANING" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markAvailable(table.id);
                  }}
                >
                  Marcar libre
                </Button>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Disponible</p>
              )}
            </div>
          );

          if (href) {
            return (
              <Link key={table.id} href={href} className="block">
                {card}
              </Link>
            );
          }

          return (
            <button
              key={table.id}
              type="button"
              className="block w-full"
              disabled={table.status === "CLEANING"}
              onClick={() => {
                if (table.status === "CLEANING") return;
                setOpening(table);
              }}
            >
              {card}
            </button>
          );
        })}
      </div>

      {opening ? (
        <OpenTableDrawer
          open={Boolean(opening)}
          onOpenChange={(v) => {
            if (!v) setOpening(null);
          }}
          tableId={opening.id}
          tableName={opening.name}
          defaultPartySize={Math.min(opening.capacity, 4)}
          waiters={waiters}
          currentUserId={currentUserId}
        />
      ) : null}
    </div>
  );
}
