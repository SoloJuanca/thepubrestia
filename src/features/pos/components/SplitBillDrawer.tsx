"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  splitBySeatsAction,
  splitCustomAction,
  splitEqualAction,
} from "@/features/pos/actions";
import { splitEqualAmounts } from "@/lib/pos-labels";
import { cn } from "@/lib/utils";

type Mode = "people" | "consumption" | "amount";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  total: number;
  partySize: number;
  seatCount: number;
};

export function SplitBillDrawer({
  open,
  onOpenChange,
  orderId,
  total,
  partySize,
  seatCount,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("people");
  const [parts, setParts] = useState(Math.max(2, partySize || 2));
  const [custom, setCustom] = useState<string[]>([]);

  const equalPreview = useMemo(
    () => (parts >= 2 ? splitEqualAmounts(total, parts) : []),
    [total, parts],
  );

  const customSum = useMemo(
    () => custom.reduce((s, v) => s + (Number(v) || 0), 0),
    [custom],
  );
  const remaining = Math.round((total - customSum) * 100) / 100;

  function syncCustom(n: number) {
    setParts(n);
    const preview = splitEqualAmounts(total, n);
    setCustom(preview.map((a) => a.toFixed(2)));
  }

  function runEqual() {
    startTransition(async () => {
      const result = await splitEqualAction({ orderId, parts });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        onOpenChange(false);
      }
    });
  }

  function runCustom() {
    startTransition(async () => {
      if (Math.abs(remaining) > 0.009) {
        toast.error(`Restante $${remaining.toFixed(2)}`);
        return;
      }
      const amounts = custom.map((v) => Number(v) || 0).filter((n) => n > 0);
      const result = await splitCustomAction({ orderId, amounts });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        onOpenChange(false);
      }
    });
  }

  function runConsumption() {
    startTransition(async () => {
      const result = await splitBySeatsAction({ orderId });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        onOpenChange(false);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Dividir cuenta</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5 p-1">
          <div className="rounded-xl bg-surface-secondary p-4">
            <p className="text-sm text-muted-foreground">TOTAL</p>
            <p className="text-3xl font-semibold">${total.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">
              {partySize || seatCount} personas
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["people", "Por personas"],
                ["consumption", "Por consumo"],
                ["amount", "Por monto"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "min-h-12 rounded-xl border px-2 text-xs font-medium sm:text-sm",
                  mode === id
                    ? "border-[var(--pub-blue)] bg-[var(--pub-blue)] text-white"
                    : "border-border bg-surface",
                )}
                onClick={() => {
                  setMode(id);
                  if (id === "amount") syncCustom(parts);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "people" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Label>¿Entre cuántas personas?</Label>
                <Button
                  variant="outline"
                  onClick={() => setParts((p) => Math.max(2, p - 1))}
                >
                  −
                </Button>
                <span className="w-8 text-center text-lg font-semibold">
                  {parts}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setParts((p) => Math.min(20, p + 1))}
                >
                  +
                </Button>
              </div>
              <ul className="space-y-2 text-sm">
                {equalPreview.map((amount, i) => (
                  <li
                    key={i}
                    className="flex justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span>Persona {i + 1}</span>
                    <span className="font-medium">${amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Asignado ${total.toFixed(2)} · Restante $0.00
              </p>
              <Button
                className="min-h-12 w-full"
                disabled={pending}
                onClick={runEqual}
              >
                Crear cuentas
              </Button>
            </div>
          ) : null}

          {mode === "consumption" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Se crea una cuenta por cada persona y se mueven los productos
                ya asignados. Lo sin asignar queda en la cuenta de mesa.
              </p>
              <p className="text-sm">
                Personas en mesa: <strong>{seatCount}</strong>
              </p>
              <Button
                className="min-h-12 w-full"
                disabled={pending || seatCount < 1}
                onClick={runConsumption}
              >
                Crear cuentas por consumo
              </Button>
            </div>
          ) : null}

          {mode === "amount" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label>Personas</Label>
                <Button
                  variant="outline"
                  onClick={() => syncCustom(Math.max(2, parts - 1))}
                >
                  −
                </Button>
                <span className="w-8 text-center font-semibold">{parts}</span>
                <Button
                  variant="outline"
                  onClick={() => syncCustom(Math.min(20, parts + 1))}
                >
                  +
                </Button>
              </div>
              {custom.map((value, i) => (
                <div key={i} className="space-y-1">
                  <Label>Persona {i + 1}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="min-h-11"
                    value={value}
                    onChange={(e) =>
                      setCustom((prev) =>
                        prev.map((v, idx) =>
                          idx === i ? e.target.value : v,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Asignado</span>
                  <span>${customSum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Restante</span>
                  <span
                    className={
                      Math.abs(remaining) > 0.009 ? "text-destructive" : ""
                    }
                  >
                    ${remaining.toFixed(2)}
                  </span>
                </div>
              </div>
              <Button
                className="min-h-12 w-full"
                disabled={pending || Math.abs(remaining) > 0.009}
                onClick={runCustom}
              >
                Crear cuentas
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
