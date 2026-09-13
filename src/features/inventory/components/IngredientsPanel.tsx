"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createIngredientAction,
  updateIngredientAction,
} from "@/features/inventory/actions";
import { UNIT_LABELS, UNIT_OPTIONS } from "@/features/inventory/labels";

export type IngredientRow = {
  id: string;
  name: string;
  category: string | null;
  baseUnit: string;
  currentStock: string;
  minimumStock: string;
  targetStock: string | null;
  averageCost: string;
  preferredSupplierId: string | null;
  preferredSupplierName: string | null;
  active: boolean;
};

type SupplierOption = { id: string; name: string };

type Props = {
  locationId: string;
  ingredients: IngredientRow[];
  suppliers: SupplierOption[];
  canAdjust: boolean;
  onSelectForOps?: (ingredientId: string) => void;
};

const emptyForm = {
  name: "",
  category: "",
  baseUnit: "UNIT" as (typeof UNIT_OPTIONS)[number],
  currentStock: "0",
  minimumStock: "0",
  targetStock: "",
  averageCost: "0",
  preferredSupplierId: "",
  active: true,
};

export function IngredientsPanel({
  locationId,
  ingredients,
  suppliers,
  canAdjust,
  onSelectForOps,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(row: IngredientRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      category: row.category ?? "",
      baseUnit: row.baseUnit as (typeof UNIT_OPTIONS)[number],
      currentStock: row.currentStock,
      minimumStock: row.minimumStock,
      targetStock: row.targetStock ?? "",
      averageCost: row.averageCost,
      preferredSupplierId: row.preferredSupplierId ?? "",
      active: row.active,
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editingId) {
        const result = await updateIngredientAction({
          id: editingId,
          name: form.name,
          category: form.category || null,
          baseUnit: form.baseUnit,
          minimumStock: Number(form.minimumStock),
          targetStock:
            form.targetStock === "" ? null : Number(form.targetStock),
          averageCost: Number(form.averageCost),
          preferredSupplierId: form.preferredSupplierId || null,
          active: form.active,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        reset();
        return;
      }

      const result = await createIngredientAction({
        locationId,
        name: form.name,
        category: form.category || null,
        baseUnit: form.baseUnit,
        currentStock: Number(form.currentStock),
        minimumStock: Number(form.minimumStock),
        targetStock:
          form.targetStock === "" ? null : Number(form.targetStock),
        averageCost: Number(form.averageCost),
        preferredSupplierId: form.preferredSupplierId || null,
        active: form.active,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      reset();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Editar ingrediente" : "Nuevo ingrediente"}
          </CardTitle>
          <CardDescription>
            El stock inicial genera un movimiento de ajuste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Input
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                placeholder="Proteínas, Bebidas…"
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad base</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.baseUnit}
                disabled={Boolean(editingId)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    baseUnit: e.target.value as (typeof UNIT_OPTIONS)[number],
                  })
                }
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            {!editingId ? (
              <div className="space-y-2">
                <Label>Stock inicial</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.currentStock}
                  onChange={(e) =>
                    setForm({ ...form, currentStock: e.target.value })
                  }
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.minimumStock}
                  onChange={(e) =>
                    setForm({ ...form, minimumStock: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Objetivo</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.targetStock}
                  onChange={(e) =>
                    setForm({ ...form, targetStock: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Costo promedio</Label>
              <Input
                type="number"
                min={0}
                step="0.0001"
                value={form.averageCost}
                onChange={(e) =>
                  setForm({ ...form, averageCost: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Proveedor preferido</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.preferredSupplierId}
                onChange={(e) =>
                  setForm({ ...form, preferredSupplierId: e.target.value })
                }
              >
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              Activo
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : editingId ? "Actualizar" : "Crear"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={reset}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingrediente</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Mín / Obj</TableHead>
              <TableHead>Costo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((row) => {
              const stock = Number(row.currentStock);
              const min = Number(row.minimumStock);
              const status =
                stock <= 0 ? "out" : stock < min ? "low" : "ok";
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/inventory/${row.id}`}
                      className="font-medium hover:text-[var(--pub-blue)] hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.category ?? "Sin categoría"} ·{" "}
                      {UNIT_LABELS[row.baseUnit]}
                    </p>
                  </TableCell>
                  <TableCell>{row.currentStock}</TableCell>
                  <TableCell>
                    {row.minimumStock} / {row.targetStock ?? "—"}
                  </TableCell>
                  <TableCell>${row.averageCost}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        status === "out"
                          ? "destructive"
                          : status === "low"
                            ? "secondary"
                            : "default"
                      }
                    >
                      {!row.active
                        ? "Inactivo"
                        : status === "out"
                          ? "Agotado"
                          : status === "low"
                            ? "Bajo"
                            : "OK"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(row)}
                    >
                      Editar
                    </Button>
                    {canAdjust && onSelectForOps ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectForOps(row.id)}
                      >
                        Ajustar / merma
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
