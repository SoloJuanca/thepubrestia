"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bulkUpdateIngredientsAction,
  createIngredientAction,
  deleteIngredientsAction,
  updateIngredientAction,
} from "@/features/inventory/actions";
import {
  INGREDIENT_KIND_LABELS,
  KIND_OPTIONS,
  UNIT_LABELS,
  UNIT_OPTIONS,
  unitChoices,
} from "@/features/inventory/labels";
import { looksPerishable } from "@/features/inventory/stock-rules";

export type IngredientRow = {
  id: string;
  name: string;
  category: string | null;
  kind: string;
  baseUnit: string;
  packSize: number | null;
  storageNote: string | null;
  currentStock: string;
  minimumStock: string;
  targetStock: string | null;
  averageCost: string;
  preferredSupplierId: string | null;
  preferredSupplierName: string | null;
  perishable: boolean;
  stockedAt: string | null;
  active: boolean;
};

type SupplierOption = { id: string; name: string };

type Props = {
  locationId: string;
  ingredients: IngredientRow[];
  suppliers: SupplierOption[];
  canAdjust: boolean;
  canCreate?: boolean;
  canViewCosts?: boolean;
  /** Open create modal on mount (e.g. ?new=1) */
  openCreateOnMount?: boolean;
  onSelectForOps?: (ingredientId: string) => void;
};

const emptyForm = {
  name: "",
  category: "",
  kind: "RAW" as (typeof KIND_OPTIONS)[number],
  baseUnit: "UNIT" as (typeof UNIT_OPTIONS)[number],
  packSize: "",
  storageNote: "",
  currentStock: "0",
  minimumStock: "0",
  targetStock: "",
  averageCost: "0",
  preferredSupplierId: "",
  perishable: false,
  active: true,
};

/** UI-only bucket for ingredients without preferred supplier (not stored in DB). */
const SUPPLIER_UNKNOWN = "unknown";

type KindFilter = "all" | "insumo" | "prep";
type SupplierFilter = "all" | typeof SUPPLIER_UNKNOWN | string;
type ActiveFilter = "active" | "inactive" | "all";

const PAGE_SIZE = 15;

export function IngredientsPanel({
  locationId,
  ingredients,
  suppliers,
  canAdjust,
  canCreate = true,
  canViewCosts = true,
  openCreateOnMount = false,
  onSelectForOps,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [perishableTouched, setPerishableTouched] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState({
    applySupplier: false,
    preferredSupplierId: "",
    applyKind: false,
    kind: "RAW" as (typeof KIND_OPTIONS)[number],
    applyCategory: false,
    category: "",
    applyMinimum: false,
    minimumStock: "0",
    applyTarget: false,
    targetStock: "",
    applyActive: false,
    active: true,
    applyStock: false,
    stockMode: "delta" as "delta" | "absolute",
    stockQuantity: "",
    stockNotes: "",
  });

  const canBulk = canCreate || canAdjust;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients.filter((row) => {
      if (activeFilter === "active" && !row.active) return false;
      if (activeFilter === "inactive" && row.active) return false;

      // Insumo = todo menos PREP; Preparado = solo PREP
      if (kindFilter === "insumo" && row.kind === "PREP") return false;
      if (kindFilter === "prep" && row.kind !== "PREP") return false;

      if (supplierFilter === SUPPLIER_UNKNOWN) {
        if (row.preferredSupplierId) return false;
      } else if (supplierFilter !== "all") {
        if (row.preferredSupplierId !== supplierFilter) return false;
      }

      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (row.category ?? "").toLowerCase().includes(q) ||
        (row.preferredSupplierName ?? "").toLowerCase().includes(q)
      );
    });
  }, [ingredients, query, kindFilter, supplierFilter, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [query, kindFilter, supplierFilter, activeFilter]);

  const pageIds = useMemo(() => pageRows.map((r) => r.id), [pageRows]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  function selectFiltered() {
    setSelectedIds(new Set(filtered.map((r) => r.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function openBulk() {
    if (selectedIds.size === 0) {
      toast.error("Selecciona al menos un ingrediente.");
      return;
    }
    setBulk({
      applySupplier: false,
      preferredSupplierId: "",
      applyKind: false,
      kind: "RAW",
      applyCategory: false,
      category: "",
      applyMinimum: false,
      minimumStock: "0",
      applyTarget: false,
      targetStock: "",
      applyActive: false,
      active: true,
      applyStock: false,
      stockMode: "delta",
      stockQuantity: "",
      stockNotes: "",
    });
    setBulkOpen(true);
  }

  function submitBulk() {
    startTransition(async () => {
      const result = await bulkUpdateIngredientsAction({
        ids: Array.from(selectedIds),
        applySupplier: canCreate && bulk.applySupplier,
        preferredSupplierId: bulk.preferredSupplierId || null,
        applyKind: canCreate && bulk.applyKind,
        kind: bulk.kind,
        applyCategory: canCreate && bulk.applyCategory,
        category: bulk.category || null,
        applyMinimum: canCreate && bulk.applyMinimum,
        minimumStock: Number(bulk.minimumStock),
        applyTarget: canCreate && bulk.applyTarget,
        targetStock:
          bulk.targetStock === "" ? null : Number(bulk.targetStock),
        applyActive: canCreate && bulk.applyActive,
        active: bulk.active,
        applyStock: canAdjust && bulk.applyStock,
        stockMode: bulk.stockMode,
        stockQuantity:
          bulk.stockQuantity === ""
            ? undefined
            : Number(bulk.stockQuantity),
        stockNotes: bulk.stockNotes || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setBulkOpen(false);
      clearSelection();
    });
  }

  function confirmDelete(ids: string[], label?: string) {
    if (ids.length === 0) return;
    const msg =
      ids.length === 1
        ? `¿Eliminar ${label ?? "este ingrediente"}? Si tiene movimientos o recetas se desactivará para conservar el historial.`
        : `¿Eliminar ${ids.length} ingredientes? Los que tengan historial o recetas se desactivarán.`;
    if (!window.confirm(msg)) return;

    startTransition(async () => {
      const result = await deleteIngredientsAction({ ids });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    });
  }

  function clearNewQuery() {
    if (searchParams.get("new") !== "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    const q = params.toString();
    router.replace(q ? `/inventory?${q}` : "/inventory?tab=ingredients");
  }

  useEffect(() => {
    if (openCreateOnMount && canCreate) {
      openCreate();
      clearNewQuery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateOnMount, canCreate]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPerishableTouched(false);
    setAddedCount(0);
    setOpen(true);
  }

  function startEdit(row: IngredientRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      category: row.category ?? "",
      kind: (row.kind as (typeof KIND_OPTIONS)[number]) || "RAW",
      baseUnit: row.baseUnit as (typeof UNIT_OPTIONS)[number],
      packSize: row.packSize != null ? String(row.packSize) : "",
      storageNote: row.storageNote ?? "",
      currentStock: row.currentStock,
      minimumStock: row.minimumStock,
      targetStock: row.targetStock ?? "",
      averageCost: row.averageCost,
      preferredSupplierId: row.preferredSupplierId ?? "",
      perishable: row.perishable,
      active: row.active,
    });
    setPerishableTouched(true);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setPerishableTouched(false);
    setAddedCount(0);
  }

  function saveIngredient(mode: "close" | "continue") {
    startTransition(async () => {
      if (editingId) {
        const result = await updateIngredientAction({
          id: editingId,
          name: form.name,
          category: form.category || null,
          kind: form.kind,
          baseUnit: form.baseUnit,
          packSize: form.packSize === "" ? null : Number(form.packSize),
          storageNote: form.storageNote || null,
          minimumStock: Number(form.minimumStock),
          targetStock:
            form.targetStock === "" ? null : Number(form.targetStock),
          averageCost: Number(form.averageCost),
          preferredSupplierId: form.preferredSupplierId || null,
          perishable: form.kind === "PREP" ? false : form.perishable,
          active: form.active,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        closeModal();
        return;
      }

      const result = await createIngredientAction({
        locationId,
        name: form.name,
        category: form.category || null,
        kind: form.kind,
        baseUnit: form.baseUnit,
        packSize: form.packSize === "" ? null : Number(form.packSize),
        storageNote: form.storageNote || null,
        currentStock: Number(form.currentStock),
        minimumStock: Number(form.minimumStock),
        targetStock:
          form.targetStock === "" ? null : Number(form.targetStock),
        averageCost: Number(form.averageCost),
        preferredSupplierId: form.preferredSupplierId || null,
        perishable: form.kind === "PREP" ? false : form.perishable,
        active: form.active,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (mode === "continue") {
        setAddedCount((n) => n + 1);
        toast.success(`${result.message} Listo para el siguiente.`);
        setForm({
          ...emptyForm,
          category: form.category,
          kind: form.kind,
          baseUnit: form.baseUnit,
          preferredSupplierId: form.preferredSupplierId,
          perishable: form.perishable,
        });
        return;
      }

      toast.success(result.message);
      closeModal();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, categoría…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <select
              className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
              value={activeFilter}
              onChange={(e) =>
                setActiveFilter(e.target.value as ActiveFilter)
              }
            >
              <option value="active">Solo activos</option>
              <option value="inactive">Solo inactivos</option>
              <option value="all">Todos</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <select
              className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            >
              <option value="all">Todos</option>
              <option value="insumo">Insumos</option>
              <option value="prep">Preparados</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Proveedor</Label>
            <select
              className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
              value={supplierFilter}
              onChange={(e) =>
                setSupplierFilter(e.target.value as SupplierFilter)
              }
            >
              <option value="all">Todos</option>
              <option value={SUPPLIER_UNKNOWN}>Unknown</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {canCreate ? (
          <Button type="button" onClick={openCreate}>
            Nuevo ingrediente
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filtered.length} de {ingredients.length}
          {filtered.length !== ingredients.length ? " (filtrados)" : ""}
          {selectedIds.size > 0
            ? ` · ${selectedIds.size} seleccionados`
            : ""}
        </p>
        {canBulk && selectedIds.size > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={openBulk}>
              Editar seleccionados
            </Button>
            {canCreate ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => confirmDelete(Array.from(selectedIds))}
                disabled={pending}
              >
                Eliminar seleccionados
              </Button>
            ) : null}
            {filtered.length > pageIds.length ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={selectFiltered}
              >
                Seleccionar filtrados ({filtered.length})
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearSelection}
            >
              Limpiar
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {canBulk ? (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={togglePage}
                    aria-label="Seleccionar página"
                  />
                </TableHead>
              ) : null}
              <TableHead>Ingrediente</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Mín / Obj</TableHead>
              {canViewCosts ? <TableHead>Costo</TableHead> : null}
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <td
                  colSpan={(canViewCosts ? 7 : 6) + (canBulk ? 1 : 0)}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No hay ingredientes con estos filtros.
                </td>
              </TableRow>
            ) : (
              pageRows.map((row) => {
                const stock = Number(row.currentStock);
                const min = Number(row.minimumStock);
                const status =
                  stock <= 0 ? "out" : stock < min ? "low" : "ok";
                const supplierLabel = row.preferredSupplierName ?? "Unknown";
                return (
                  <TableRow
                    key={row.id}
                    className={
                      selectedIds.has(row.id) ? "bg-muted/40" : undefined
                    }
                  >
                    {canBulk ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          className="cursor-pointer"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Seleccionar ${row.name}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Link
                        href={`/inventory/${row.id}`}
                        className="font-medium hover:text-[var(--pub-blue)] hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {INGREDIENT_KIND_LABELS[row.kind] ?? row.kind} ·{" "}
                        {row.category ?? "Sin categoría"} ·{" "}
                        {UNIT_LABELS[row.baseUnit]}
                        {row.packSize ? ` · x${row.packSize}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          row.preferredSupplierId
                            ? "text-sm"
                            : "text-sm text-muted-foreground"
                        }
                      >
                        {supplierLabel}
                      </span>
                    </TableCell>
                    <TableCell>{row.currentStock}</TableCell>
                    <TableCell>
                      {row.minimumStock} / {row.targetStock ?? "—"}
                    </TableCell>
                    {canViewCosts ? (
                      <TableCell>${row.averageCost}</TableCell>
                    ) : null}
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
                      {canCreate ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(row)}
                        >
                          Editar
                        </Button>
                      ) : null}
                      {canCreate ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => confirmDelete([row.id], row.name)}
                        >
                          Eliminar
                        </Button>
                      ) : null}
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
              })
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Página {safePage} de {totalPages} · {PAGE_SIZE} por página
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeModal();
          else setOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar" : "Nuevo insumo o preparado"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Actualiza los datos del insumo."
                : addedCount > 0
                  ? `Llevas ${addedCount} agregados en esta tanda. Sigue o cierra.`
                  : "El stock inicial genera un movimiento de ajuste. Puedes guardar varios seguidos."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="ingredient-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveIngredient(editingId ? "close" : "continue");
            }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const perishable =
                    !editingId && !perishableTouched && form.kind !== "PREP"
                      ? looksPerishable(name, form.category)
                      : form.perishable;
                  setForm({ ...form, name, perishable });
                }}
                required
                autoFocus
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Qué es</Label>
                <select
                  className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.kind === "PREP" ? "PREP" : "INSUMO"}
                  onChange={(e) => {
                    if (e.target.value === "PREP") {
                      setForm({ ...form, kind: "PREP", perishable: false });
                      return;
                    }
                    setForm({
                      ...form,
                      kind: form.kind === "PREP" ? "RAW" : form.kind,
                    });
                  }}
                >
                  <option value="INSUMO">Insumo</option>
                  <option value="PREP">Preparado</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Se cuenta en</Label>
                <select
                  className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.baseUnit}
                  disabled={Boolean(editingId)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      baseUnit: e.target.value as (typeof UNIT_OPTIONS)[number],
                    })
                  }
                >
                  {unitChoices(form.baseUnit).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABELS[u] ?? u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {form.kind !== "PREP" ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.perishable}
                  onChange={(e) => {
                    setPerishableTouched(true);
                    setForm({ ...form, perishable: e.target.checked });
                  }}
                />
                <span>
                  Perecedero
                  <span className="block text-xs text-muted-foreground">
                    Verdura, fruta, carne y similares. Avisa si lleva más de 5
                    días.
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">
                Los preparados avisan solos si llevan más de 3 días.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Pzas / caja</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.packSize}
                  onChange={(e) =>
                    setForm({ ...form, packSize: e.target.value })
                  }
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label>Nota almacén</Label>
                <Input
                  value={form.storageNote}
                  onChange={(e) =>
                    setForm({ ...form, storageNote: e.target.value })
                  }
                  placeholder="Congelado…"
                />
              </div>
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
            {canViewCosts ? (
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
            ) : null}
            <div className="space-y-2">
              <Label>Proveedor preferido</Label>
              <select
                className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
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
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              Activo
            </label>
          </form>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={closeModal}
              disabled={pending}
            >
              {addedCount > 0 ? "Cerrar" : "Cancelar"}
            </Button>
            <div className="flex flex-wrap gap-2">
              {editingId ? (
                <Button
                  type="submit"
                  form="ingredient-form"
                  disabled={pending}
                >
                  {pending ? "Guardando…" : "Actualizar"}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || !form.name.trim()}
                    onClick={() => saveIngredient("close")}
                  >
                    Guardar y cerrar
                  </Button>
                  <Button
                    type="submit"
                    form="ingredient-form"
                    disabled={pending}
                  >
                    {pending ? "Guardando…" : "Guardar y seguir"}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkOpen}
        onOpenChange={(next) => {
          if (!next) setBulkOpen(false);
          else setBulkOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar en lote</DialogTitle>
            <DialogDescription>
              Se aplicará a {selectedIds.size} ingredientes. Marca solo los
              campos que quieras cambiar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {canCreate ? (
              <>
                <fieldset className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulk.applySupplier}
                      onChange={(e) =>
                        setBulk({ ...bulk, applySupplier: e.target.checked })
                      }
                    />
                    Proveedor preferido
                  </label>
                  <select
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
                    disabled={!bulk.applySupplier}
                    value={bulk.preferredSupplierId}
                    onChange={(e) =>
                      setBulk({
                        ...bulk,
                        preferredSupplierId: e.target.value,
                      })
                    }
                  >
                    <option value="">Unknown (sin proveedor)</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </fieldset>

                <fieldset className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulk.applyKind}
                      onChange={(e) =>
                        setBulk({ ...bulk, applyKind: e.target.checked })
                      }
                    />
                    Tipo
                  </label>
                  <select
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
                    disabled={!bulk.applyKind}
                    value={bulk.kind}
                    onChange={(e) =>
                      setBulk({
                        ...bulk,
                        kind: e.target.value as (typeof KIND_OPTIONS)[number],
                      })
                    }
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {INGREDIENT_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </fieldset>

                <fieldset className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulk.applyCategory}
                      onChange={(e) =>
                        setBulk({ ...bulk, applyCategory: e.target.checked })
                      }
                    />
                    Categoría
                  </label>
                  <Input
                    disabled={!bulk.applyCategory}
                    value={bulk.category}
                    onChange={(e) =>
                      setBulk({ ...bulk, category: e.target.value })
                    }
                    placeholder="Proteínas, Bebidas…"
                  />
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <fieldset className="space-y-2 rounded-lg border border-border p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={bulk.applyMinimum}
                        onChange={(e) =>
                          setBulk({ ...bulk, applyMinimum: e.target.checked })
                        }
                      />
                      Stock mínimo
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.0001"
                      disabled={!bulk.applyMinimum}
                      value={bulk.minimumStock}
                      onChange={(e) =>
                        setBulk({ ...bulk, minimumStock: e.target.value })
                      }
                    />
                  </fieldset>
                  <fieldset className="space-y-2 rounded-lg border border-border p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={bulk.applyTarget}
                        onChange={(e) =>
                          setBulk({ ...bulk, applyTarget: e.target.checked })
                        }
                      />
                      Stock objetivo
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.0001"
                      disabled={!bulk.applyTarget}
                      value={bulk.targetStock}
                      onChange={(e) =>
                        setBulk({ ...bulk, targetStock: e.target.value })
                      }
                      placeholder="Vacío = sin objetivo"
                    />
                  </fieldset>
                </div>

                <fieldset className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulk.applyActive}
                      onChange={(e) =>
                        setBulk({ ...bulk, applyActive: e.target.checked })
                      }
                    />
                    Estado activo
                  </label>
                  <select
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
                    disabled={!bulk.applyActive}
                    value={bulk.active ? "1" : "0"}
                    onChange={(e) =>
                      setBulk({ ...bulk, active: e.target.value === "1" })
                    }
                  >
                    <option value="1">Activo</option>
                    <option value="0">Inactivo</option>
                  </select>
                </fieldset>
              </>
            ) : null}

            {canAdjust ? (
              <fieldset className="space-y-2 rounded-lg border border-border p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={bulk.applyStock}
                    onChange={(e) =>
                      setBulk({ ...bulk, applyStock: e.target.checked })
                    }
                  />
                  Existencias (stock)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
                    disabled={!bulk.applyStock}
                    value={bulk.stockMode}
                    onChange={(e) =>
                      setBulk({
                        ...bulk,
                        stockMode: e.target.value as "delta" | "absolute",
                      })
                    }
                  >
                    <option value="delta">Sumar / restar</option>
                    <option value="absolute">Fijar cantidad</option>
                  </select>
                  <Input
                    type="number"
                    step="0.0001"
                    disabled={!bulk.applyStock}
                    value={bulk.stockQuantity}
                    onChange={(e) =>
                      setBulk({ ...bulk, stockQuantity: e.target.value })
                    }
                    placeholder={
                      bulk.stockMode === "delta" ? "Ej. 10 o -2" : "Ej. 0"
                    }
                  />
                </div>
                <Input
                  disabled={!bulk.applyStock}
                  value={bulk.stockNotes}
                  onChange={(e) =>
                    setBulk({ ...bulk, stockNotes: e.target.value })
                  }
                  placeholder="Nota del movimiento (opcional)"
                />
              </fieldset>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setBulkOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={submitBulk}
              disabled={pending}
            >
              {pending
                ? "Aplicando…"
                : `Aplicar a ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
