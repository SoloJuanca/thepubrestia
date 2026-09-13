"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InventoryStatusPanel } from "@/features/inventory/components/InventoryStatusPanel";
import {
  IngredientsPanel,
  type IngredientRow,
} from "@/features/inventory/components/IngredientsPanel";
import {
  RecipesPanel,
  type RecipeMenuItem,
} from "@/features/inventory/components/RecipesPanel";
import { StockOpsPanel } from "@/features/inventory/components/StockOpsPanel";
import {
  MovementsPanel,
  type MovementRow,
} from "@/features/inventory/components/MovementsPanel";
import type { AlertIngredient } from "@/services/inventory.service";

type Tab = "estado" | "ingredients" | "recipes" | "ops" | "movements";

type Props = {
  locationId: string;
  canAdjust: boolean;
  alerts: {
    low: AlertIngredient[];
    out: AlertIngredient[];
    suggested: AlertIngredient[];
  };
  pendingPurchaseOrders: number;
  ingredients: IngredientRow[];
  suppliers: Array<{ id: string; name: string }>;
  menuItems: RecipeMenuItem[];
  movements: MovementRow[];
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "estado", label: "Estado del inventario" },
  { id: "ingredients", label: "Ingredientes" },
  { id: "recipes", label: "Recetas" },
  { id: "ops", label: "Entradas / Mermas" },
  { id: "movements", label: "Movimientos" },
];

export function InventoryAdminView({
  locationId,
  canAdjust,
  alerts,
  pendingPurchaseOrders: _pendingPurchaseOrders,
  ingredients,
  suppliers,
  menuItems,
  movements,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const normalizedTab =
    tabParam === "alerts" ? "estado" : (tabParam as Tab | null);
  const tab: Tab = TABS.some((t) => t.id === normalizedTab)
    ? (normalizedTab as Tab)
    : "estado";
  const opsFocus = searchParams.get("focus") === "waste" ? "waste" : "entrada";
  const [opsIngredientId, setOpsIngredientId] = useState(
    () => ingredients[0]?.id ?? "",
  );

  const effectiveOpsId = opsIngredientId || ingredients[0]?.id || "";

  const inventoryValue = ingredients.reduce((sum, row) => {
    if (!row.active) return sum;
    return sum + Number(row.currentStock) * Number(row.averageCost);
  }, 0);

  function setTab(next: Tab, extra?: { focus?: "entrada" | "waste" }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "estado") params.delete("tab");
    else params.set("tab", next);
    if (extra?.focus) params.set("focus", extra.focus);
    else params.delete("focus");
    router.push(`/inventory${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado del stock, recetas y movimientos auditados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdjust ? (
            <>
              <Button
                variant="outline"
                className="border-[var(--pub-blue)]/40"
                onClick={() => setTab("ops", { focus: "entrada" })}
              >
                Registrar entrada
              </Button>
              <Button
                variant="outline"
                onClick={() => setTab("ops", { focus: "waste" })}
              >
                Registrar merma
              </Button>
            </>
          ) : null}
          <Button onClick={() => setTab("ingredients")}>
            Nuevo ingrediente
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((item) => {
          if (item.id === "ops" && !canAdjust) return null;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                tab === item.id
                  ? "bg-[var(--pub-blue)] text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "estado" ? (
        <InventoryStatusPanel
          ingredients={ingredients.filter((i) => i.active)}
          lowCount={alerts.low.length}
          outCount={alerts.out.length}
          suggestedCount={alerts.suggested.length}
          inventoryValue={inventoryValue}
        />
      ) : null}

      {tab === "ingredients" ? (
        <IngredientsPanel
          locationId={locationId}
          ingredients={ingredients}
          suppliers={suppliers}
          canAdjust={canAdjust}
          onSelectForOps={(id) => {
            setOpsIngredientId(id);
            setTab("ops", { focus: "entrada" });
          }}
        />
      ) : null}

      {tab === "recipes" ? (
        <RecipesPanel
          menuItems={menuItems}
          ingredients={ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            baseUnit: i.baseUnit,
          }))}
        />
      ) : null}

      {tab === "ops" && canAdjust ? (
        <StockOpsPanel
          key={`${effectiveOpsId}-${opsFocus}`}
          selectedIngredientId={effectiveOpsId}
          focus={opsFocus}
          ingredients={ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            baseUnit: i.baseUnit,
            currentStock: i.currentStock,
          }))}
        />
      ) : null}

      {tab === "movements" ? <MovementsPanel movements={movements} /> : null}
    </div>
  );
}
