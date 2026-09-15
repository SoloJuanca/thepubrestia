"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createSupplierAction,
  saveSchedulesAction,
  updateSupplierAction,
  upsertSupplierProductAction,
  removeSupplierProductAction,
} from "@/features/suppliers/actions";
import {
  WEEKDAY_LABELS,
  WEEKDAY_OPTIONS,
} from "@/features/purchases/labels";
import { UNIT_LABELS, UNIT_OPTIONS } from "@/features/inventory/labels";
import { cn } from "@/lib/utils";

export type SupplierRow = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  leadTimeDays: number | null;
  active: boolean;
  schedules: Array<{ orderDay: string; deliveryDay: string }>;
  products: Array<{
    id: string;
    ingredientId: string;
    ingredientName: string;
    supplierSku: string | null;
    unit: string;
    unitCost: string;
    minOrderQty: string | null;
    active: boolean;
  }>;
};

export type DueTodayRow = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  deliveries: string[];
  productCount: number;
};

type IngredientOption = {
  id: string;
  name: string;
  baseUnit: string;
  averageCost: string;
};

type Props = {
  locationId: string;
  canWrite: boolean;
  suppliers: SupplierRow[];
  dueToday: DueTodayRow[];
  ingredients: IngredientOption[];
  todayLabel: string;
};

const emptyForm = {
  name: "",
  contact: "",
  phone: "",
  whatsapp: "",
  email: "",
  notes: "",
  leadTimeDays: "",
  active: true,
};

const DETAIL_TABS = [
  "Información",
  "Productos",
  "Calendario",
  "Pedidos",
] as const;

const WEEKDAY_TO_JS: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function nextOrderDayLabel(
  schedules: Array<{ orderDay: string }>,
): string | null {
  if (schedules.length === 0) return null;
  const today = new Date().getDay();
  let bestOffset = 8;
  let bestDay: string | null = null;
  for (const s of schedules) {
    const target = WEEKDAY_TO_JS[s.orderDay];
    if (target == null) continue;
    const offset = (target - today + 7) % 7;
    if (offset < bestOffset) {
      bestOffset = offset;
      bestDay = s.orderDay;
    }
  }
  if (!bestDay) return null;
  if (bestOffset === 0) return `Hoy (${WEEKDAY_LABELS[bestDay]})`;
  if (bestOffset === 1) return `Mañana (${WEEKDAY_LABELS[bestDay]})`;
  return WEEKDAY_LABELS[bestDay] ?? bestDay;
}

export function SuppliersAdminView({
  locationId,
  canWrite,
  suppliers,
  dueToday,
  ingredients,
  todayLabel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(suppliers[0]?.id ?? "");
  const [detailTab, setDetailTab] =
    useState<(typeof DETAIL_TABS)[number]>("Información");
  const [orderDay, setOrderDay] = useState<(typeof WEEKDAY_OPTIONS)[number]>(
    "MONDAY",
  );
  const [deliveryDay, setDeliveryDay] =
    useState<(typeof WEEKDAY_OPTIONS)[number]>("TUESDAY");
  const [catalog, setCatalog] = useState({
    ingredientId: "",
    supplierSku: "",
    unit: "UNIT" as (typeof UNIT_OPTIONS)[number],
    unitCost: "0",
    minOrderQty: "",
  });

  const selected = useMemo(
    () => suppliers.find((s) => s.id === selectedId) ?? null,
    [suppliers, selectedId],
  );

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(row: SupplierRow) {
    setEditingId(row.id);
    setSelectedId(row.id);
    setForm({
      name: row.name,
      contact: row.contact ?? "",
      phone: row.phone ?? "",
      whatsapp: row.whatsapp ?? "",
      email: row.email ?? "",
      notes: row.notes ?? "",
      leadTimeDays:
        row.leadTimeDays != null ? String(row.leadTimeDays) : "",
      active: row.active,
    });
  }

  function saveSupplier() {
    startTransition(async () => {
      const payload = {
        ...form,
        email: form.email || null,
        contact: form.contact || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        notes: form.notes || null,
        leadTimeDays:
          form.leadTimeDays === "" ? null : Number(form.leadTimeDays),
      };
      const result = editingId
        ? await updateSupplierAction({ id: editingId, ...payload })
        : await createSupplierAction({ locationId, ...payload });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        if (result.id) setSelectedId(result.id);
        resetForm();
      }
    });
  }

  function addSchedule() {
    if (!selected) return;
    const next = [
      ...selected.schedules,
      { orderDay, deliveryDay },
    ];
    startTransition(async () => {
      const result = await saveSchedulesAction({
        supplierId: selected.id,
        schedules: next,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    });
  }

  function removeSchedule(index: number) {
    if (!selected) return;
    const next = selected.schedules.filter((_, i) => i !== index);
    startTransition(async () => {
      const result = await saveSchedulesAction({
        supplierId: selected.id,
        schedules: next,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    });
  }

  function saveProduct() {
    if (!selected || !catalog.ingredientId) {
      toast.error("Selecciona un ingrediente.");
      return;
    }
    startTransition(async () => {
      const result = await upsertSupplierProductAction({
        supplierId: selected.id,
        ingredientId: catalog.ingredientId,
        supplierSku: catalog.supplierSku || null,
        unit: catalog.unit,
        unitCost: Number(catalog.unitCost) || 0,
        minOrderQty: catalog.minOrderQty
          ? Number(catalog.minOrderQty)
          : null,
        active: true,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setCatalog({
          ingredientId: "",
          supplierSku: "",
          unit: "UNIT",
          unitCost: "0",
          minOrderQty: "",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contactos, calendarios de pedido/entrega y catálogo suministrado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos de hoy ({todayLabel})</CardTitle>
          <CardDescription>
            Proveedores con día de pedido igual a hoy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dueToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún proveedor toca pedir hoy.
            </p>
          ) : (
            <ul className="space-y-2">
              {dueToday.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-muted-foreground">
                      Entrega:{" "}
                      {row.deliveries
                        .map((d) => WEEKDAY_LABELS[d] ?? d)
                        .join(", ")}{" "}
                      · {row.productCount} productos
                    </p>
                  </div>
                  <div className="text-muted-foreground">
                    {row.whatsapp || row.phone || "Sin teléfono"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Editar proveedor" : "Nuevo proveedor"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                disabled={!canWrite || pending}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Contacto</Label>
                <Input
                  value={form.contact}
                  disabled={!canWrite || pending}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  disabled={!canWrite || pending}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input
                  value={form.phone}
                  disabled={!canWrite || pending}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp}
                  disabled={!canWrite || pending}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Lead time (días)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={form.leadTimeDays}
                disabled={!canWrite || pending}
                placeholder="Ej. 2"
                onChange={(e) =>
                  setForm((f) => ({ ...f, leadTimeDays: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea
                rows={2}
                value={form.notes}
                disabled={!canWrite || pending}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                disabled={!canWrite || pending}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Activo
            </label>
            {canWrite ? (
              <div className="flex gap-2">
                <Button disabled={pending || !form.name.trim()} onClick={saveSupplier}>
                  {editingId ? "Guardar" : "Crear"}
                </Button>
                {editingId ? (
                  <Button variant="outline" disabled={pending} onClick={resetForm}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proveedores</CardTitle>
            <CardDescription>{suppliers.length} registros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay proveedores.
              </p>
            ) : (
              suppliers.map((row) => {
                const nextOrder = nextOrderDayLabel(row.schedules);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      selectedId === row.id
                        ? "border-[var(--pub-blue)] bg-[var(--pub-blue)]/5"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {row.whatsapp || row.phone || row.email || "Sin contacto"}
                        </p>
                        {nextOrder ? (
                          <p className="mt-1 text-xs text-[var(--pub-blue-dark)]">
                            Próximo pedido: {nextOrder}
                            {row.leadTimeDays != null
                              ? ` · lead ${row.leadTimeDays}d`
                              : ""}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sin calendario de pedido
                            {row.leadTimeDays != null
                              ? ` · lead ${row.leadTimeDays}d`
                              : ""}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.products.length} productos · Contacto:{" "}
                          {row.contact || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={row.active ? "default" : "secondary"}>
                          {row.active ? "Activo" : "Inactivo"}
                        </Badge>
                        {canWrite ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(row);
                            }}
                          >
                            Editar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {selected ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    detailTab === tab
                      ? "bg-[var(--pub-blue)] text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {detailTab === "Información" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Contacto:</span>{" "}
                  {selected.contact || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">WhatsApp:</span>{" "}
                  {selected.whatsapp || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Teléfono:</span>{" "}
                  {selected.phone || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {selected.email || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Lead time:</span>{" "}
                  {selected.leadTimeDays != null
                    ? `${selected.leadTimeDays} días`
                    : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Notas:</span>{" "}
                  {selected.notes || "—"}
                </p>
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(selected)}
                  >
                    Editar datos
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {detailTab === "Calendario" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Calendario — {selected.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {selected.schedules.length === 0 ? (
                    <li className="text-muted-foreground">
                      Sin días configurados.
                    </li>
                  ) : (
                    selected.schedules.map((s, index) => (
                      <li
                        key={`${s.orderDay}-${s.deliveryDay}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                      >
                        <span>
                          Pedir {WEEKDAY_LABELS[s.orderDay]} {"->"} entrega{" "}
                          {WEEKDAY_LABELS[s.deliveryDay]}
                        </span>
                        {canWrite ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => removeSchedule(index)}
                          >
                            Quitar
                          </Button>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
                {canWrite ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label>Día pedido</Label>
                      <select
                        className="flex h-10 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={orderDay}
                        onChange={(e) =>
                          setOrderDay(
                            e.target.value as (typeof WEEKDAY_OPTIONS)[number],
                          )
                        }
                      >
                        {WEEKDAY_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {WEEKDAY_LABELS[d]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Día entrega</Label>
                      <select
                        className="flex h-10 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={deliveryDay}
                        onChange={(e) =>
                          setDeliveryDay(
                            e.target.value as (typeof WEEKDAY_OPTIONS)[number],
                          )
                        }
                      >
                        {WEEKDAY_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {WEEKDAY_LABELS[d]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button disabled={pending} onClick={addSchedule}>
                      Agregar
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {detailTab === "Productos" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Productos y precios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.ingredientName}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.supplierSku ?? "sin SKU"} ·{" "}
                            {UNIT_LABELS[p.unit]}
                          </div>
                        </TableCell>
                        <TableCell>${p.unitCost}</TableCell>
                        <TableCell>
                          {canWrite ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() =>
                                startTransition(async () => {
                                  const result =
                                    await removeSupplierProductAction({
                                      id: p.id,
                                    });
                                  if (!result.ok) toast.error(result.error);
                                  else toast.success(result.message);
                                })
                              }
                            >
                              Quitar
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {canWrite ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Ingrediente</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        value={catalog.ingredientId}
                        onChange={(e) => {
                          const ing = ingredients.find(
                            (i) => i.id === e.target.value,
                          );
                          setCatalog((c) => ({
                            ...c,
                            ingredientId: e.target.value,
                            unit:
                              (ing?.baseUnit as (typeof UNIT_OPTIONS)[number]) ??
                              c.unit,
                            unitCost: ing?.averageCost ?? c.unitCost,
                          }));
                        }}
                      >
                        <option value="">Seleccionar…</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>SKU</Label>
                      <Input
                        value={catalog.supplierSku}
                        onChange={(e) =>
                          setCatalog((c) => ({
                            ...c,
                            supplierSku: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Unidad</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        value={catalog.unit}
                        onChange={(e) =>
                          setCatalog((c) => ({
                            ...c,
                            unit: e.target.value as (typeof UNIT_OPTIONS)[number],
                          }))
                        }
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {UNIT_LABELS[u]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Costo unitario</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={catalog.unitCost}
                        onChange={(e) =>
                          setCatalog((c) => ({
                            ...c,
                            unitCost: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Mín. pedido</Label>
                      <Input
                        type="number"
                        min={0}
                        value={catalog.minOrderQty}
                        onChange={(e) =>
                          setCatalog((c) => ({
                            ...c,
                            minOrderQty: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button disabled={pending} onClick={saveProduct}>
                        Guardar en catálogo
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {detailTab === "Pedidos" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos</CardTitle>
                <CardDescription>
                  Gestiona pedidos a este proveedor desde el módulo Pedidos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Productos en catálogo:{" "}
                  <strong>{selected.products.length}</strong>
                </p>
                <p>
                  Próximo día de pedido:{" "}
                  {nextOrderDayLabel(selected.schedules) ?? "Sin calendario"}
                </p>
                <a
                  href="/purchases"
                  className={cn(
                    "inline-flex h-9 items-center rounded-md bg-[var(--pub-blue)] px-3 text-sm font-medium text-white",
                  )}
                >
                  Ir a pedidos
                </a>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
