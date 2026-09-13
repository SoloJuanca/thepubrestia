"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { closeCheckAction } from "@/features/payments/actions";
import { PAYMENT_METHOD_LABELS } from "@/services/printer.service";

type PaymentDraft = {
  key: string;
  method: "CASH" | "CARD" | "TRANSFER";
  amount: string;
  tipAmount: string;
  reference: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkId: string;
  checkName: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
};

export function PaymentSheet({
  open,
  onOpenChange,
  checkId,
  checkName,
  subtotal,
  discountTotal,
  taxTotal,
  total,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const totalNum = Number(total);
  const [lines, setLines] = useState<PaymentDraft[]>([
    {
      key: crypto.randomUUID(),
      method: "CASH",
      amount: total,
      tipAmount: "0",
      reference: "",
    },
  ]);

  const paid = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
    [lines],
  );
  const tips = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.tipAmount) || 0), 0),
    [lines],
  );
  const remaining = Math.max(0, Math.round((totalNum - paid) * 100) / 100);

  function fillRemaining(index: number) {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, amount: remaining.toFixed(2) } : line,
      ),
    );
  }

  function onSubmit() {
    startTransition(async () => {
      const result = await closeCheckAction({
        checkId,
        payments: lines.map((l) => ({
          method: l.method,
          amount: Number(l.amount) || 0,
          tipAmount: Number(l.tipAmount) || 0,
          reference: l.reference || null,
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.push(`/tickets/${checkId}`);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Cobrar — {checkName}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 p-1">
          <div className="rounded-xl border border-border p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Descuentos</span>
              <span>-${discountTotal}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Impuestos</span>
              <span>${taxTotal}</span>
            </div>
            <div className="mt-2 flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>${total}</span>
            </div>
          </div>

          {lines.map((line, index) => (
            <div
              key={line.key}
              className="space-y-2 rounded-xl border border-border p-3"
            >
              <div className="flex items-center justify-between">
                <Label>Pago {index + 1}</Label>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
              <select
                className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={line.method}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l) =>
                      l.key === line.key
                        ? {
                            ...l,
                            method: e.target.value as PaymentDraft["method"],
                          }
                        : l,
                    ),
                  )
                }
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Monto</Label>
                  <Input
                    className="min-h-11"
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.amount}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, amount: e.target.value }
                            : l,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Propina</Label>
                  <Input
                    className="min-h-11"
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.tipAmount}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, tipAmount: e.target.value }
                            : l,
                        ),
                      )
                    }
                  />
                </div>
              </div>
              <Input
                placeholder="Referencia (opcional)"
                value={line.reference}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l) =>
                      l.key === line.key
                        ? { ...l, reference: e.target.value }
                        : l,
                    ),
                  )
                }
              />
              {remaining > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fillRemaining(index)}
                >
                  Completar ${remaining.toFixed(2)}
                </Button>
              ) : null}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                {
                  key: crypto.randomUUID(),
                  method: "CARD",
                  amount: remaining > 0 ? remaining.toFixed(2) : "0",
                  tipAmount: "0",
                  reference: "",
                },
              ])
            }
          >
            Agregar método de pago
          </Button>

          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Pagado</span>
              <span>${paid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Propinas</span>
              <span>${tips.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Restante</span>
              <span className={remaining > 0 ? "text-destructive" : ""}>
                ${remaining.toFixed(2)}
              </span>
            </div>
          </div>

          <Button
            className="min-h-12 w-full text-base"
            size="lg"
            disabled={pending || remaining > 0.009}
            onClick={onSubmit}
          >
            {pending ? "Cobrando…" : "Confirmar cobro"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
