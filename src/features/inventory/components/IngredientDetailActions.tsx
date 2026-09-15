"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  adjustStockAction,
  recordWasteAction,
} from "@/features/inventory/actions";
import { WASTE_REASON_LABELS } from "@/features/inventory/labels";
import { cn } from "@/lib/utils";

type Props = {
  ingredientId: string;
  ingredientName: string;
  unitLabel: string;
  showOrderCta: boolean;
};

export function IngredientDetailActions({
  ingredientId,
  ingredientName,
  unitLabel,
  showOrderCta,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [mermaOpen, setMermaOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [wasteReason, setWasteReason] = useState("DAMAGED");

  function onEntrada() {
    startTransition(async () => {
      const result = await adjustStockAction({
        ingredientId,
        mode: "delta",
        quantity: Number(qty),
        notes: notes || "Entrada desde detalle",
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Entrada registrada");
        setQty("");
        setNotes("");
        setEntradaOpen(false);
      }
    });
  }

  function onMerma() {
    startTransition(async () => {
      const result = await recordWasteAction({
        ingredientId,
        quantity: Number(qty),
        reason: wasteReason as
          | "DAMAGED"
          | "EXPIRED"
          | "KITCHEN_ERROR"
          | "COMP"
          | "INTERNAL"
          | "OTHER",
        comment: notes || null,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Merma registrada");
        setQty("");
        setNotes("");
        setMermaOpen(false);
      }
    });
  }

  function addToOrder() {
    toast.success(`${ingredientName} listo para el próximo pedido`, {
      description: "Revisa la sección Necesitamos pedir.",
      action: {
        label: "Ir a pedidos",
        onClick: () => {
          window.location.href = "/purchases";
        },
      },
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setEntradaOpen(true)}>
          Registrar entrada
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setMermaOpen(true)}
        >
          Registrar merma
        </Button>
        {showOrderCta ? (
          <Button type="button" variant="secondary" onClick={addToOrder}>
            Agregar al próximo pedido
          </Button>
        ) : (
          <Link
            href="/purchases"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Ir a pedidos
          </Link>
        )}
      </div>

      <Sheet open={entradaOpen} onOpenChange={setEntradaOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Registrar entrada — {ingredientName}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Cantidad ({unitLabel})</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              disabled={pending || !(Number(qty) > 0)}
              onClick={onEntrada}
            >
              Confirmar entrada
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={mermaOpen} onOpenChange={setMermaOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Registrar merma — {ingredientName}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Cantidad ({unitLabel})</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={wasteReason}
                onChange={(e) => setWasteReason(e.target.value)}
              >
                {Object.entries(WASTE_REASON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              disabled={pending || !(Number(qty) > 0)}
              onClick={onMerma}
            >
              Confirmar merma
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
