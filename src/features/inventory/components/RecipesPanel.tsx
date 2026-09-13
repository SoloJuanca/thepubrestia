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
import { saveRecipeAction } from "@/features/inventory/actions";
import { UNIT_LABELS, UNIT_OPTIONS } from "@/features/inventory/labels";

export type RecipeMenuItem = {
  id: string;
  name: string;
  categoryName: string;
  items: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: string;
    unit: string;
  }>;
};

type IngredientOption = {
  id: string;
  name: string;
  baseUnit: string;
};

type DraftLine = {
  key: string;
  ingredientId: string;
  quantity: string;
  unit: string;
};

type Props = {
  menuItems: RecipeMenuItem[];
  ingredients: IngredientOption[];
};

export function RecipesPanel({ menuItems, ingredients }: Props) {
  const [selectedId, setSelectedId] = useState(menuItems[0]?.id ?? "");
  const selected = useMemo(
    () => menuItems.find((m) => m.id === selectedId) ?? null,
    [menuItems, selectedId],
  );
  const [lines, setLines] = useState<DraftLine[]>(() =>
    (menuItems[0]?.items ?? []).map((item) => ({
      key: crypto.randomUUID(),
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
    })),
  );
  const [pending, startTransition] = useTransition();

  function loadItem(id: string) {
    setSelectedId(id);
    const item = menuItems.find((m) => m.id === id);
    setLines(
      (item?.items ?? []).map((row) => ({
        key: crypto.randomUUID(),
        ingredientId: row.ingredientId,
        quantity: row.quantity,
        unit: row.unit,
      })),
    );
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    startTransition(async () => {
      const result = await saveRecipeAction({
        menuItemId: selectedId,
        items: lines.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: Number(line.quantity),
          unit: line.unit as (typeof UNIT_OPTIONS)[number],
        })),
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    });
  }

  if (menuItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay productos de menú. Crea productos en Fase 2 primero.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
          <CardDescription>Selecciona uno para editar su receta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => loadItem(item.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedId === item.id
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/60"
              }`}
            >
              <span className="block">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {item.categoryName} · {item.items.length} insumos
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Receta — {selected?.name ?? "—"}
          </CardTitle>
          <CardDescription>
            Al vender, el consumo se calculará desde aquí (Fase 4/5).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="space-y-4">
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-[1fr_100px_110px_auto]"
              >
                <div className="space-y-1">
                  <Label>Ingrediente</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={line.ingredientId}
                    onChange={(e) => {
                      const ingredient = ingredients.find(
                        (i) => i.id === e.target.value,
                      );
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? {
                                ...l,
                                ingredientId: e.target.value,
                                unit: ingredient?.baseUnit ?? l.unit,
                              }
                            : l,
                        ),
                      );
                    }}
                    required
                  >
                    <option value="">Selecciona…</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min={0.0001}
                    step="0.0001"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, quantity: e.target.value }
                            : l,
                        ),
                      )
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Unidad</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={line.unit}
                    onChange={(e) =>
                      setLines((prev) =>
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
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    {
                      key: crypto.randomUUID(),
                      ingredientId: ingredients[0]?.id ?? "",
                      quantity: "1",
                      unit: ingredients[0]?.baseUnit ?? "UNIT",
                    },
                  ])
                }
              >
                Agregar insumo
              </Button>
              <Button type="submit" disabled={pending || !selectedId}>
                {pending ? "Guardando…" : "Guardar receta"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
