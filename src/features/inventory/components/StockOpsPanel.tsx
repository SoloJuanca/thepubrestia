"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  adjustStockAction,
  recordWasteAction,
} from "@/features/inventory/actions";
import {
  UNIT_LABELS,
  WASTE_REASON_LABELS,
} from "@/features/inventory/labels";

type IngredientOption = {
  id: string;
  name: string;
  baseUnit: string;
  currentStock: string;
  preferredSupplierId?: string | null;
};

type SupplierOption = { id: string; name: string };

type Props = {
  ingredients: IngredientOption[];
  suppliers: SupplierOption[];
  selectedIngredientId?: string;
  /** Highlight entrada (ajuste) or merma card */
  focus?: "entrada" | "waste";
};

export function StockOpsPanel({
  ingredients,
  suppliers,
  selectedIngredientId,
  focus = "entrada",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [entryNotes, setEntryNotes] = useState("");

  const [wasteIngredientId, setWasteIngredientId] = useState(
    selectedIngredientId ?? ingredients[0]?.id ?? "",
  );
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("DAMAGED");
  const [wasteComment, setWasteComment] = useState("");

  const supplierIngredients = useMemo(() => {
    if (!supplierId) return [];
    return ingredients.filter((i) => i.preferredSupplierId === supplierId);
  }, [ingredients, supplierId]);

  function onReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Selecciona un proveedor.");
      return;
    }
    const lines = supplierIngredients
      .map((ing) => ({
        ingredientId: ing.id,
        name: ing.name,
        qty: Number(qtys[ing.id] || 0),
      }))
      .filter((l) => l.qty > 0);

    if (lines.length === 0) {
      toast.error("Indica al menos una cantidad.");
      return;
    }

    const supplierName =
      suppliers.find((s) => s.id === supplierId)?.name ?? "Proveedor";

    startTransition(async () => {
      let ok = 0;
      for (const line of lines) {
        const result = await adjustStockAction({
          ingredientId: line.ingredientId,
          mode: "delta",
          quantity: line.qty,
          notes:
            entryNotes.trim() ||
            `Entrada · ${supplierName} · ${line.name}`,
        });
        if (!result.ok) {
          toast.error(`${line.name}: ${result.error}`);
          return;
        }
        ok += 1;
      }
      toast.success(`Entrada registrada (${ok} insumos).`);
      setQtys({});
      setEntryNotes("");
    });
  }

  function onWaste(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordWasteAction({
        ingredientId: wasteIngredientId,
        quantity: Number(wasteQty),
        reason: wasteReason as
          | "DAMAGED"
          | "EXPIRED"
          | "KITCHEN_ERROR"
          | "COMP"
          | "INTERNAL"
          | "OTHER",
        comment: wasteComment || null,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setWasteQty("");
        setWasteComment("");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card
        className={
          focus === "entrada" ? "border-[var(--pub-blue)]" : undefined
        }
      >
        <CardHeader>
          <CardTitle className="text-base">Registrar entrada</CardTitle>
          <CardDescription>
            1) Proveedor → 2) insumos de ese proveedor → 3) cantidades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onReceive} className="space-y-4">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <select
                className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setQtys({});
                }}
                required
              >
                <option value="">Selecciona proveedor…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {!supplierId ? (
              <p className="text-sm text-muted-foreground">
                Elige un proveedor para ver sus insumos.
              </p>
            ) : supplierIngredients.length === 0 ? (
              <p className="text-sm text-amber-700">
                No hay insumos con este proveedor preferido. Asigna el proveedor
                en Ingredientes.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Cantidades a recibir</Label>
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {supplierIngredients.map((ing) => (
                    <div
                      key={ing.id}
                      className="grid grid-cols-[1fr_110px] items-center gap-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {ing.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stock: {ing.currentStock}{" "}
                          {UNIT_LABELS[ing.baseUnit] ?? ing.baseUnit}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        placeholder="0"
                        value={qtys[ing.id] ?? ""}
                        onChange={(e) =>
                          setQtys((prev) => ({
                            ...prev,
                            [ing.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                rows={2}
                placeholder="Factura, lote…"
              />
            </div>
            <Button
              type="submit"
              disabled={pending || !supplierId || supplierIngredients.length === 0}
            >
              {pending ? "Registrando…" : "Confirmar entrada"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card
        className={focus === "waste" ? "border-[var(--pub-blue)]" : undefined}
      >
        <CardHeader>
          <CardTitle className="text-base">Registrar merma</CardTitle>
          <CardDescription>
            Descuenta stock por daño, caducidad u otro motivo. Queda auditado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onWaste} className="space-y-3">
            <div className="space-y-2">
              <Label>Ingrediente</Label>
              <select
                className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                value={wasteIngredientId}
                onChange={(e) => setWasteIngredientId(e.target.value)}
                required
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={0.0001}
                step="0.0001"
                value={wasteQty}
                onChange={(e) => setWasteQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Razón</Label>
              <select
                className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                value={wasteReason}
                onChange={(e) => setWasteReason(e.target.value)}
              >
                {Object.entries(WASTE_REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Comentario</Label>
              <Textarea
                value={wasteComment}
                onChange={(e) => setWasteComment(e.target.value)}
                rows={2}
              />
            </div>
            <Button type="submit" disabled={pending || !wasteIngredientId}>
              {pending ? "Registrando…" : "Registrar merma"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
