"use client";

import { useState, useTransition } from "react";
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
};

type Props = {
  ingredients: IngredientOption[];
  selectedIngredientId?: string;
  /** Highlight entrada (ajuste) or merma card */
  focus?: "entrada" | "waste";
};

export function StockOpsPanel({
  ingredients,
  selectedIngredientId,
  focus = "entrada",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [ingredientId, setIngredientId] = useState(
    selectedIngredientId ?? ingredients[0]?.id ?? "",
  );
  const selected =
    ingredients.find((i) => i.id === ingredientId) ?? ingredients[0];

  const [adjustMode, setAdjustMode] = useState<"delta" | "absolute">("delta");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("DAMAGED");
  const [wasteComment, setWasteComment] = useState("");

  if (selectedIngredientId && selectedIngredientId !== ingredientId) {
    // sync when parent changes selection without remounting awkwardly
  }

  function onAdjust(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await adjustStockAction({
        ingredientId,
        mode: adjustMode,
        quantity: Number(adjustQty),
        notes: adjustNotes || null,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setAdjustQty("");
        setAdjustNotes("");
      }
    });
  }

  function onWaste(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordWasteAction({
        ingredientId,
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
          <CardTitle className="text-base">Registrar entrada / ajuste</CardTitle>
          <CardDescription>
            Usa cantidad positiva para entradas. Queda auditado en movimientos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdjust} className="space-y-3">
            <IngredientSelect
              ingredients={ingredients}
              value={ingredientId}
              onChange={setIngredientId}
            />
            {selected ? (
              <p className="text-xs text-muted-foreground">
                Stock actual: {selected.currentStock}{" "}
                {UNIT_LABELS[selected.baseUnit]}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label>Modo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={adjustMode}
                onChange={(e) =>
                  setAdjustMode(e.target.value as "delta" | "absolute")
                }
              >
                <option value="delta">Delta (+/-)</option>
                <option value="absolute">Fijar stock absoluto</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>
                {adjustMode === "delta" ? "Cantidad (+/-)" : "Nuevo stock"}
              </Label>
              <Input
                type="number"
                step="0.0001"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                rows={2}
              />
            </div>
            <Button type="submit" disabled={pending || !ingredientId}>
              {pending ? "Aplicando…" : "Aplicar ajuste"}
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
            <IngredientSelect
              ingredients={ingredients}
              value={ingredientId}
              onChange={setIngredientId}
            />
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
            <Button type="submit" disabled={pending || !ingredientId}>
              {pending ? "Registrando…" : "Registrar merma"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function IngredientSelect({
  ingredients,
  value,
  onChange,
}: {
  ingredients: IngredientOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Ingrediente</Label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        {ingredients.map((ing) => (
          <option key={ing.id} value={ing.id}>
            {ing.name}
          </option>
        ))}
      </select>
    </div>
  );
}
