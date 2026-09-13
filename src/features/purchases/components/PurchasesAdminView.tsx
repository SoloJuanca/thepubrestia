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
  createPurchaseOrderAction,
  createSuggestedPosAction,
  receivePurchaseOrderAction,
  setPoStatusAction,
} from "@/features/purchases/actions";
import { PO_STATUS_LABELS } from "@/features/purchases/labels";
import { UNIT_LABELS, UNIT_OPTIONS } from "@/features/inventory/labels";
import { cn } from "@/lib/utils";

export type PurchaseOrderRow = {
  id: string;
  status: string;
  supplierId: string;
  supplierName: string;
  notes: string | null;
  orderedAtLabel: string | null;
  expectedDeliveryLabel: string | null;
  receivedAtLabel: string | null;
  createdAtLabel: string;
  itemCount: number;
  items: Array<{
    id: string;
    ingredientId: string;
    ingredientName: string;
    quantityOrdered: string;
    quantityReceived: string;
    unit: string;
    expectedUnitCost: string;
    actualUnitCost: string | null;
  }>;
};

type SupplierOption = {
  id: string;
  name: string;
  products: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    unitCost: string;
  }>;
};

type IngredientOption = {
  id: string;
  name: string;
  baseUnit: string;
  averageCost: string;
  suggestedPurchase: number;
  preferredSupplierName: string | null;
};

type DraftLine = {
  key: string;
  ingredientId: string;
  quantityOrdered: string;
  unit: (typeof UNIT_OPTIONS)[number];
  expectedUnitCost: string;
};

type Props = {
  locationId: string;
  canWrite: boolean;
  canReceive: boolean;
  orders: PurchaseOrderRow[];
  suppliers: SupplierOption[];
  suggested: IngredientOption[];
};

export function PurchasesAdminView({
  locationId,
  canWrite,
  canReceive,
  orders,
  suppliers,
  suggested,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [receiveCost, setReceiveCost] = useState<Record<string, string>>({});

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  );

  const supplier = suppliers.find((s) => s.id === supplierId);

  const pipeline = useMemo(() => {
    const drafts = orders.filter((o) => o.status === "DRAFT");
    const ordered = orders.filter((o) => o.status === "PENDING");
    const toReceive = orders.filter((o) =>
      ["ORDERED", "PARTIALLY_RECEIVED"].includes(o.status),
    );
    const received = orders.filter((o) => o.status === "RECEIVED");
    return { drafts, ordered, toReceive, received };
  }, [orders]);

  function addLineFromCatalog(ingredientId: string) {
    const product = supplier?.products.find(
      (p) => p.ingredientId === ingredientId,
    );
    if (!product) return;
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        ingredientId: product.ingredientId,
        quantityOrdered: "1",
        unit: product.unit as (typeof UNIT_OPTIONS)[number],
        expectedUnitCost: product.unitCost,
      },
    ]);
  }

  function createPo() {
    if (!supplierId || !lines.length) {
      toast.error("Selecciona proveedor e ítems.");
      return;
    }
    startTransition(async () => {
      const result = await createPurchaseOrderAction({
        locationId,
        supplierId,
        notes: notes || null,
        items: lines.map((l) => ({
          ingredientId: l.ingredientId,
          quantityOrdered: Number(l.quantityOrdered) || 0,
          unit: l.unit,
          expectedUnitCost: Number(l.expectedUnitCost) || 0,
        })),
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setLines([]);
        setNotes("");
        if (result.id) setSelectedId(result.id);
      }
    });
  }

  function receive() {
    if (!selected) return;
    const payload = selected.items
      .map((item) => ({
        itemId: item.id,
        quantityReceived: Number(receiveQty[item.id] || 0),
        actualUnitCost: receiveCost[item.id]
          ? Number(receiveCost[item.id])
          : Number(item.expectedUnitCost),
      }))
      .filter((l) => l.quantityReceived > 0);

    startTransition(async () => {
      const result = await receivePurchaseOrderAction({
        poId: selected.id,
        lines: payload,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setReceiveQty({});
        setReceiveCost({});
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sugeridos, borradores, pedidos a proveedor y recepción.
          </p>
        </div>
        {canWrite ? (
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() =>
              startTransition(async () => {
                const result = await createSuggestedPosAction({ locationId });
                if (!result.ok) toast.error(result.error);
                else toast.success(result.message);
              })
            }
          >
            Generar borradores sugeridos
          </Button>
        ) : null}
      </div>

      <Card className="border-[var(--pub-blue)]/25">
        <CardHeader>
          <CardTitle className="text-base">Necesitamos pedir</CardTitle>
          <CardDescription>
            Insumos con stock bajo o agotado y cantidad sugerida.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {suggested.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada pendiente por stock.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Sugerido</TableHead>
                  <TableHead>Proveedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggested.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>
                      {s.suggestedPurchase} {UNIT_LABELS[s.baseUnit]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.preferredSupplierName ?? "Sin preferido"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          {canWrite ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nueva orden (borrador)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Proveedor</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={supplierId}
                    onChange={(e) => {
                      setSupplierId(e.target.value);
                      setLines([]);
                    }}
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Agregar del catálogo</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addLineFromCatalog(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Seleccionar producto…</option>
                    {supplier?.products.map((p) => (
                      <option key={p.ingredientId} value={p.ingredientId}>
                        {p.ingredientName} · ${p.unitCost}
                      </option>
                    ))}
                  </select>
                </div>

                {lines.map((line) => {
                  const name =
                    supplier?.products.find(
                      (p) => p.ingredientId === line.ingredientId,
                    )?.ingredientName ?? line.ingredientId;
                  return (
                    <div
                      key={line.key}
                      className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4"
                    >
                      <div className="sm:col-span-4 text-sm font-medium">
                        {name}
                      </div>
                      <div className="space-y-1">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.quantityOrdered}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, quantityOrdered: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Costo</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          value={line.expectedUnitCost}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? {
                                      ...l,
                                      expectedUnitCost: e.target.value,
                                    }
                                  : l,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Unidad</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                          value={line.unit}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? {
                                      ...l,
                                      unit: e.target
                                        .value as (typeof UNIT_OPTIONS)[number],
                                    }
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
                          variant="ghost"
                          onClick={() =>
                            setLines((prev) =>
                              prev.filter((l) => l.key !== line.key),
                            )
                          }
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <div className="space-y-1">
                  <Label>Notas</Label>
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <Button disabled={pending || !lines.length} onClick={createPo}>
                  Crear borrador
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline de pedidos</CardTitle>
              <CardDescription>{orders.length} registros</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <PipelineSection
                title="Sugeridos"
                hint={`${suggested.length} insumos`}
                empty="Sin sugerencias de stock."
              >
                {suggested.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ver sección «Necesitamos pedir» arriba. Usa «Generar
                    borradores sugeridos» para crear órdenes.
                  </p>
                ) : null}
              </PipelineSection>

              <PipelineSection
                title="Borradores"
                empty="Sin borradores."
              >
                {pipeline.drafts.map((order) => (
                  <OrderListButton
                    key={order.id}
                    order={order}
                    selected={selectedId === order.id}
                    onSelect={() => setSelectedId(order.id)}
                  />
                ))}
              </PipelineSection>

              <PipelineSection
                title="Ordenados"
                empty="Sin pedidos ordenados."
              >
                {pipeline.ordered.map((order) => (
                  <OrderListButton
                    key={order.id}
                    order={order}
                    selected={selectedId === order.id}
                    onSelect={() => setSelectedId(order.id)}
                  />
                ))}
              </PipelineSection>

              <PipelineSection
                title="Por recibir"
                empty="Nada por recibir."
              >
                {pipeline.toReceive.map((order) => (
                  <OrderListButton
                    key={order.id}
                    order={order}
                    selected={selectedId === order.id}
                    onSelect={() => setSelectedId(order.id)}
                  />
                ))}
              </PipelineSection>

              <PipelineSection
                title="Recibidos"
                empty="Aún no hay pedidos recibidos."
              >
                {pipeline.received.map((order) => (
                  <OrderListButton
                    key={order.id}
                    order={order}
                    selected={selectedId === order.id}
                    onSelect={() => setSelectedId(order.id)}
                  />
                ))}
              </PipelineSection>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalle</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.supplierName} · ${PO_STATUS_LABELS[selected.status]}`
                : "Selecciona una orden"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Sin selección.</p>
            ) : (
              <>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Creada: </span>
                    {selected.createdAtLabel}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Pedida: </span>
                    {selected.orderedAtLabel ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Recibida: </span>
                    {selected.receivedAtLabel ?? "—"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Notas: </span>
                    {selected.notes ?? "—"}
                  </p>
                </div>

                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "DRAFT" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await setPoStatusAction({
                                poId: selected.id,
                                status: "PENDING",
                              });
                              if (!result.ok) toast.error(result.error);
                              else toast.success(result.message);
                            })
                          }
                        >
                          Enviar a pendiente
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await setPoStatusAction({
                                poId: selected.id,
                                status: "ORDERED",
                              });
                              if (!result.ok) toast.error(result.error);
                              else toast.success(result.message);
                            })
                          }
                        >
                          Marcar pedida
                        </Button>
                      </>
                    ) : null}
                    {selected.status === "PENDING" ? (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setPoStatusAction({
                              poId: selected.id,
                              status: "ORDERED",
                            });
                            if (!result.ok) toast.error(result.error);
                            else toast.success(result.message);
                          })
                        }
                      >
                        Marcar pedida
                      </Button>
                    ) : null}
                    {["DRAFT", "PENDING", "ORDERED"].includes(
                      selected.status,
                    ) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setPoStatusAction({
                              poId: selected.id,
                              status: "CANCELLED",
                            });
                            if (!result.ok) toast.error(result.error);
                            else toast.success(result.message);
                          })
                        }
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Recibido</TableHead>
                      {canReceive &&
                      ["PENDING", "ORDERED", "PARTIALLY_RECEIVED"].includes(
                        selected.status,
                      ) ? (
                        <>
                          <TableHead>Recibir</TableHead>
                          <TableHead>Costo real</TableHead>
                        </>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.items.map((item) => {
                      const remaining =
                        Number(item.quantityOrdered) -
                        Number(item.quantityReceived);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">
                              {item.ingredientName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ${item.expectedUnitCost} /{" "}
                              {UNIT_LABELS[item.unit]}
                            </div>
                          </TableCell>
                          <TableCell>{item.quantityOrdered}</TableCell>
                          <TableCell>{item.quantityReceived}</TableCell>
                          {canReceive &&
                          ["PENDING", "ORDERED", "PARTIALLY_RECEIVED"].includes(
                            selected.status,
                          ) ? (
                            <>
                              <TableCell>
                                <Input
                                  className="min-w-20"
                                  type="number"
                                  min={0}
                                  max={remaining}
                                  step="0.01"
                                  placeholder={String(remaining)}
                                  value={receiveQty[item.id] ?? ""}
                                  onChange={(e) =>
                                    setReceiveQty((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="min-w-24"
                                  type="number"
                                  min={0}
                                  step="0.0001"
                                  placeholder={item.expectedUnitCost}
                                  value={receiveCost[item.id] ?? ""}
                                  onChange={(e) =>
                                    setReceiveCost((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                />
                              </TableCell>
                            </>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {canReceive &&
                ["PENDING", "ORDERED", "PARTIALLY_RECEIVED"].includes(
                  selected.status,
                ) ? (
                  <Button disabled={pending} onClick={receive}>
                    Registrar recepción
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PipelineSection({
  title,
  hint,
  empty,
  children,
}: {
  title: string;
  hint?: string;
  empty: string;
  children?: React.ReactNode;
}) {
  const childArray = Array.isArray(children)
    ? children.filter(Boolean)
    : children != null && children !== false
      ? [children]
      : [];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {childArray.length > 0 ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function OrderListButton({
  order,
  selected,
  onSelect,
}: {
  order: PurchaseOrderRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition-colors",
        selected
          ? "border-[var(--pub-blue)] bg-[var(--pub-blue)]/5"
          : "border-border hover:bg-muted/40",
      )}
    >
      <div>
        <p className="font-medium">{order.supplierName}</p>
        <p className="text-muted-foreground">
          {order.itemCount} ítems · {order.createdAtLabel}
        </p>
      </div>
      <Badge variant="secondary">
        {PO_STATUS_LABELS[order.status] ?? order.status}
      </Badge>
    </button>
  );
}
