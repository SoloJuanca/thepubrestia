"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  runProductionBatchAction,
  savePrepRecipeAction,
} from "@/features/inventory/actions";
import { UNIT_LABELS, UNIT_OPTIONS } from "@/features/inventory/labels";

export type PrepRecipeRow = {
  id: string;
  outputIngredientId: string;
  outputName: string;
  outputUnit: string;
  outputQuantity: string;
  notes: string | null;
  items: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: string;
    unit: string;
  }>;
};

export type ProductionBatchRow = {
  id: string;
  producedAt: string;
  outputName: string;
  quantityTheoretical: string;
  quantityProduced: string;
  yieldPercent: string;
  employeeName: string | null;
  notes: string | null;
};

type IngredientOption = {
  id: string;
  name: string;
  baseUnit: string;
  kind: string;
};

type Props = {
  locationId: string;
  canAdjust: boolean;
  canEditRecipes?: boolean;
  prepIngredients: IngredientOption[];
  allIngredients: IngredientOption[];
  recipes: PrepRecipeRow[];
  batches: ProductionBatchRow[];
};

export function ProductionPanel({
  locationId,
  canAdjust,
  canEditRecipes = false,
  prepIngredients,
  allIngredients,
  recipes,
  batches,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [outputId, setOutputId] = useState(
    prepIngredients[0]?.id ?? recipes[0]?.outputIngredientId ?? "",
  );
  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.outputIngredientId === outputId) ?? null,
    [recipes, outputId],
  );
  const [multiplier, setMultiplier] = useState("1");
  const [produced, setProduced] = useState(
    selectedRecipe?.outputQuantity ?? "1",
  );
  const [notes, setNotes] = useState("");

  // Prep recipe editor
  const [editOutputQty, setEditOutputQty] = useState(
    selectedRecipe?.outputQuantity ?? "1",
  );
  const [editLines, setEditLines] = useState(
    () =>
      selectedRecipe?.items.map((i) => ({
        key: crypto.randomUUID(),
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
      })) ?? [],
  );

  function selectOutput(id: string) {
    setOutputId(id);
    const recipe = recipes.find((r) => r.outputIngredientId === id);
    setProduced(recipe?.outputQuantity ?? "1");
    setEditOutputQty(recipe?.outputQuantity ?? "1");
    setEditLines(
      (recipe?.items ?? []).map((i) => ({
        key: crypto.randomUUID(),
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
      })),
    );
  }

  function onRunBatch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await runProductionBatchAction({
        locationId,
        outputIngredientId: outputId,
        quantityProduced: Number(produced),
        batchMultiplier: Number(multiplier),
        notes: notes || null,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setNotes("");
      }
    });
  }

  function onSaveRecipe(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await savePrepRecipeAction({
        locationId,
        outputIngredientId: outputId,
        outputQuantity: Number(editOutputQty),
        items: editLines.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: Number(l.quantity),
          unit: l.unit as (typeof UNIT_OPTIONS)[number],
        })),
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    });
  }

  if (prepIngredients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay insumos tipo Producción (PREP). Clasifica o crea ingredientes
        PREP (guacamole, carnes, salsas…).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar producción</CardTitle>
            <CardDescription>
              Consume insumos de la receta PREP y suma stock al producto
              terminado. Mide rendimiento real vs teórico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onRunBatch} className="space-y-3">
              <div className="space-y-1">
                <Label>Producto PREP</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={outputId}
                  onChange={(e) => selectOutput(e.target.value)}
                >
                  {prepIngredients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Multiplicador de receta</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>
                    Cantidad real producida (
                    {prepIngredients.find((p) => p.id === outputId)?.baseUnit})
                  </Label>
                  <Input
                    type="number"
                    min={0.0001}
                    step="0.0001"
                    value={produced}
                    onChange={(e) => setProduced(e.target.value)}
                    required
                  />
                </div>
              </div>
              {selectedRecipe ? (
                <p className="text-xs text-muted-foreground">
                  Teórico por batch: {selectedRecipe.outputQuantity} · Insumos:{" "}
                  {selectedRecipe.items.length}
                </p>
              ) : (
                <p className="text-xs text-amber-700">
                  Sin receta de producción — configúrala a la derecha antes de
                  producir.
                </p>
              )}
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <Button
                type="submit"
                disabled={!canAdjust || pending || !selectedRecipe}
                className="w-full"
              >
                {pending ? "Produciendo…" : "Confirmar batch"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receta de producción</CardTitle>
            <CardDescription>
              Qué insumos crudos/congelados se gastan para 1 batch teórico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveRecipe} className="space-y-3">
              <div className="space-y-1">
                <Label>Salida teórica (batch = 1)</Label>
                <Input
                  type="number"
                  min={0.0001}
                  step="0.0001"
                  value={editOutputQty}
                  onChange={(e) => setEditOutputQty(e.target.value)}
                  required
                />
              </div>
              {editLines.map((line) => (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_90px_90px_auto]"
                >
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={line.ingredientId}
                    onChange={(e) =>
                      setEditLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, ingredientId: e.target.value }
                            : l,
                        ),
                      )
                    }
                  >
                    {allIngredients
                      .filter((i) => i.kind !== "PREP" || i.id !== outputId)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                  </select>
                  <Input
                    type="number"
                    min={0.0001}
                    step="0.0001"
                    value={line.quantity}
                    onChange={(e) =>
                      setEditLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, quantity: e.target.value }
                            : l,
                        ),
                      )
                    }
                  />
                  <select
                    className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={line.unit}
                    onChange={(e) =>
                      setEditLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, unit: e.target.value }
                            : l,
                        ),
                      )
                    }
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditLines((prev) =>
                        prev.filter((l) => l.key !== line.key),
                      )
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setEditLines((prev) => [
                      ...prev,
                      {
                        key: crypto.randomUUID(),
                        ingredientId: allIngredients[0]?.id ?? "",
                        quantity: "1",
                        unit: allIngredients[0]?.baseUnit ?? "UNIT",
                      },
                    ])
                  }
                >
                  Agregar insumo
                </Button>
                <Button
                  type="submit"
                  disabled={pending || !canEditRecipes}
                >
                  Guardar receta PREP
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos batches</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Producto</th>
                <th className="py-2 pr-3 font-medium">Teórico</th>
                <th className="py-2 pr-3 font-medium">Real</th>
                <th className="py-2 pr-3 font-medium">Rendimiento</th>
                <th className="py-2 font-medium">Quién</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-muted-foreground">
                    Sin batches aún.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{b.producedAt}</td>
                    <td className="py-2 pr-3">{b.outputName}</td>
                    <td className="py-2 pr-3">{b.quantityTheoretical}</td>
                    <td className="py-2 pr-3">{b.quantityProduced}</td>
                    <td className="py-2 pr-3 font-medium">{b.yieldPercent}%</td>
                    <td className="py-2">{b.employeeName ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
