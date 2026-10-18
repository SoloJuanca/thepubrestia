"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  ProductionPanel,
  type PrepRecipeRow,
  type ProductionBatchRow,
} from "@/features/inventory/components/ProductionPanel";
import {
  WasteHistoryPanel,
  type WasteHistoryRow,
} from "@/features/inventory/components/WasteHistoryPanel";
import {
  YieldReportPanel,
  type YieldReportRow,
} from "@/features/inventory/components/YieldReportPanel";
import type { AlertIngredient } from "@/services/inventory.service";

export type InventoryTab =
  | "home"
  | "estado"
  | "ingredients"
  | "recipes"
  | "production"
  | "ops"
  | "waste"
  | "yield"
  | "movements";

type Props = {
  locationId: string;
  canAdjust: boolean;
  canViewInventory: boolean;
  canManageIngredients: boolean;
  canEditRecipes: boolean;
  canViewRecipes: boolean;
  canViewCosts: boolean;
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
  prepRecipes: PrepRecipeRow[];
  productionBatches: ProductionBatchRow[];
  wasteRows: WasteHistoryRow[];
  yieldRows: YieldReportRow[];
  yieldFromLabel: string;
  yieldToLabel: string;
};

type TaskCard = {
  id: InventoryTab;
  label: string;
  description: string;
  focus?: "entrada" | "waste";
  primary?: boolean;
};

function tabAllowed(
  id: InventoryTab,
  flags: {
    canViewInventory: boolean;
    canAdjust: boolean;
    canManageIngredients: boolean;
    canViewRecipes: boolean;
  },
) {
  if (id === "home") return true;
  if (id === "recipes") return flags.canViewRecipes;
  if (id === "ops") return flags.canAdjust;
  if (id === "ingredients") {
    return flags.canViewInventory || flags.canManageIngredients;
  }
  if (id === "production") return flags.canAdjust || flags.canViewInventory;
  return flags.canViewInventory;
}

export function InventoryAdminView({
  locationId,
  canAdjust,
  canViewInventory,
  canManageIngredients,
  canEditRecipes,
  canViewRecipes,
  canViewCosts,
  alerts,
  pendingPurchaseOrders,
  ingredients,
  suppliers,
  menuItems,
  movements,
  prepRecipes,
  productionBatches,
  wasteRows,
  yieldRows,
  yieldFromLabel,
  yieldToLabel,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const normalizedTab =
    tabParam === "alerts" ? "estado" : (tabParam as InventoryTab | null);
  const flags = {
    canViewInventory,
    canAdjust,
    canManageIngredients,
    canViewRecipes,
  };

  const tab: InventoryTab =
    normalizedTab && tabAllowed(normalizedTab, flags)
      ? normalizedTab
      : "home";

  const opsFocus = searchParams.get("focus") === "waste" ? "waste" : "entrada";
  const [opsIngredientId, setOpsIngredientId] = useState(
    () => ingredients[0]?.id ?? "",
  );
  const [moreOpen, setMoreOpen] = useState(false);

  const effectiveOpsId = opsIngredientId || ingredients[0]?.id || "";

  const inventoryValue = ingredients.reduce((sum, row) => {
    if (!row.active) return sum;
    return sum + Number(row.currentStock) * Number(row.averageCost);
  }, 0);

  const prepIngredients = ingredients
    .filter((i) => i.kind === "PREP" && i.active)
    .map((i) => ({
      id: i.id,
      name: i.name,
      baseUnit: i.baseUnit,
      kind: i.kind,
    }));

  function setTab(next: InventoryTab, extra?: { focus?: "entrada" | "waste" }) {
    const params = new URLSearchParams();
    if (next === "home") {
      router.push("/inventory");
      return;
    }
    params.set("tab", next);
    if (extra?.focus) params.set("focus", extra.focus);
    if (searchParams.get("new") === "1" && next === "ingredients") {
      params.set("new", "1");
    }
    router.push(`/inventory?${params}`);
  }

  const primaryTasks: TaskCard[] = (
    [
      {
        id: "estado",
        label: "Estado del stock",
        description: "Alertas, bajos y valor",
        primary: true,
      },
      {
        id: "ops",
        label: "Registrar entrada",
        description: "Recibir producto",
        focus: "entrada",
        primary: true,
      },
      {
        id: "ops",
        label: "Registrar merma",
        description: "Baja de existencias",
        focus: "waste",
        primary: true,
      },
      {
        id: "production",
        label: "Producción",
        description: "Batches PREP",
        primary: true,
      },
      {
        id: "ingredients",
        label: "Catálogo",
        description: "Ingredientes y mínimos",
        primary: true,
      },
      {
        id: "recipes",
        label: "Recetas de venta",
        description: "Platillos ↔ insumos",
        primary: true,
      },
    ] satisfies TaskCard[]
  ).filter((t) => tabAllowed(t.id, flags));

  const moreTasks: TaskCard[] = (
    [
      {
        id: "waste",
        label: "Historial mermas",
        description: "Registro pasado",
      },
      {
        id: "yield",
        label: "Rendimiento",
        description: "Teórico vs real",
      },
      {
        id: "movements",
        label: "Movimientos",
        description: "Kardex reciente",
      },
    ] satisfies TaskCard[]
  ).filter((t) => tabAllowed(t.id, flags));

  if (tab === "home") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige una tarea. {alerts.low.length + alerts.out.length} alertas ·{" "}
            {pendingPurchaseOrders} pedidos abiertos.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {primaryTasks.map((task) => (
            <button
              key={`${task.id}-${task.focus ?? task.label}`}
              type="button"
              onClick={() =>
                setTab(task.id, task.focus ? { focus: task.focus } : undefined)
              }
              className="cursor-pointer rounded-xl border border-border bg-surface p-5 text-left transition-colors hover:border-[var(--pub-blue)]/50 hover:bg-accent/40"
            >
              <h2 className="text-lg font-semibold tracking-tight">
                {task.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {task.description}
              </p>
            </button>
          ))}
        </div>

        {moreTasks.length > 0 ? (
          <div className="space-y-2">
            <button
              type="button"
              className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setMoreOpen((o) => !o)}
            >
              {moreOpen ? "Ocultar más" : "Más en inventario"}
            </button>
            {moreOpen ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {moreTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setTab(task.id)}
                    className="cursor-pointer rounded-xl border border-dashed border-border p-4 text-left hover:bg-muted/40"
                  >
                    <h3 className="font-medium">{task.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {canManageIngredients ? (
          <Button
            onClick={() => {
              router.push("/inventory?tab=ingredients&new=1");
            }}
          >
            Nuevo ingrediente
          </Button>
        ) : null}
      </div>
    );
  }

  const tabLabel =
    [...primaryTasks, ...moreTasks].find(
      (t) =>
        t.id === tab &&
        (tab !== "ops" ||
          (opsFocus === "waste"
            ? t.focus === "waste"
            : t.focus === "entrada" || !t.focus)),
    )?.label ?? "Inventario";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => setTab("home")}
            className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ← Todas las tareas
          </button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {tabLabel}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdjust && tab !== "ops" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("ops", { focus: "entrada" })}
              >
                Entrada
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("ops", { focus: "waste" })}
              >
                Merma
              </Button>
            </>
          ) : null}
          {canManageIngredients ? (
            <Button
              size="sm"
              onClick={() => {
                router.push("/inventory?tab=ingredients&new=1");
              }}
            >
              Nuevo ingrediente
            </Button>
          ) : null}
        </div>
      </div>

      {tab === "estado" ? (
        <InventoryStatusPanel
          ingredients={ingredients.filter((i) => i.active)}
          lowCount={alerts.low.length}
          outCount={alerts.out.length}
          suggestedCount={alerts.suggested.length}
          inventoryValue={inventoryValue}
          canViewCosts={canViewCosts}
        />
      ) : null}

      {tab === "ingredients" ? (
        <IngredientsPanel
          locationId={locationId}
          ingredients={ingredients}
          suppliers={suppliers}
          canAdjust={canAdjust}
          canCreate={canManageIngredients}
          canViewCosts={canViewCosts}
          openCreateOnMount={searchParams.get("new") === "1"}
          onSelectForOps={(id) => {
            setOpsIngredientId(id);
            setTab("ops", { focus: "entrada" });
          }}
        />
      ) : null}

      {tab === "recipes" ? (
        <RecipesPanel
          menuItems={menuItems}
          canEdit={canEditRecipes}
          canViewCosts={canViewCosts}
          ingredients={ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            baseUnit: i.baseUnit,
            averageCost: i.averageCost,
          }))}
        />
      ) : null}

      {tab === "production" ? (
        <ProductionPanel
          locationId={locationId}
          canAdjust={canAdjust}
          canEditRecipes={canEditRecipes}
          prepIngredients={prepIngredients}
          allIngredients={ingredients
            .filter((i) => i.active)
            .map((i) => ({
              id: i.id,
              name: i.name,
              baseUnit: i.baseUnit,
              kind: i.kind,
            }))}
          recipes={prepRecipes}
          batches={productionBatches}
        />
      ) : null}

      {tab === "ops" && canAdjust ? (
        <StockOpsPanel
          key={`${effectiveOpsId}-${opsFocus}`}
          selectedIngredientId={effectiveOpsId}
          focus={opsFocus}
          suppliers={suppliers}
          ingredients={ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            baseUnit: i.baseUnit,
            currentStock: i.currentStock,
            preferredSupplierId: i.preferredSupplierId,
          }))}
        />
      ) : null}

      {tab === "waste" ? (
        <WasteHistoryPanel rows={wasteRows} canViewCosts={canViewCosts} />
      ) : null}

      {tab === "yield" ? (
        <YieldReportPanel
          rows={yieldRows}
          fromLabel={yieldFromLabel}
          toLabel={yieldToLabel}
        />
      ) : null}

      {tab === "movements" ? <MovementsPanel movements={movements} /> : null}

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/inventory" className="underline-offset-2 hover:underline">
          Volver al menú de tareas
        </Link>
      </p>
    </div>
  );
}
