"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  addOrderItemAction,
  addSeatAction,
  endTableSessionAction,
  removeOrderItemAction,
  sendToKitchenAction,
  updateItemQtyAction,
} from "@/features/pos/actions";
import { PaymentSheet } from "@/features/payments/components/PaymentSheet";
import { SplitBillDrawer } from "@/features/pos/components/SplitBillDrawer";
import { displayCheckName } from "@/lib/pos-labels";

export type PosCategory = { id: string; name: string };

export type PosMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  price: string;
  imageUrl: string | null;
  requiresPrep: boolean;
  modifierGroups: Array<{
    id: string;
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    options: Array<{ id: string; name: string; priceDelta: string }>;
  }>;
};

export type PosCheck = {
  id: string;
  name: string;
  status: string;
  customerId: string | null;
  promotionId: string | null;
  promotionCode: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  items: Array<{
    id: string;
    nameSnapshot: string;
    quantity: number;
    lineTotal: string;
    status: string;
    modifiers: string[];
    seatId: string | null;
  }>;
};

export type PosSeat = {
  id: string;
  label: string;
  displayName: string | null;
};

export type PosSession = {
  tableId: string;
  tableName: string;
  orderId: string;
  ticketNumber: number | null;
  partySize: number | null;
  openMinutes: number;
  waiterName: string | null;
  checks: PosCheck[];
  seats: PosSeat[];
  categories: PosCategory[];
  menuItems: PosMenuItem[];
};

type Props = { session: PosSession };

export function TableSessionView({ session }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeCheckId, setActiveCheckId] = useState(
    session.checks[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [seatId, setSeatId] = useState<string | null>(null);
  const [modifierItem, setModifierItem] = useState<PosMenuItem | null>(null);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [payOpen, setPayOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [payCheckId, setPayCheckId] = useState<string | null>(null);

  const activeCheck =
    session.checks.find((c) => c.id === activeCheckId) ?? session.checks[0];
  const payCheck =
    session.checks.find((c) => c.id === payCheckId) ?? activeCheck;

  const closedCount = session.checks.filter((c) => c.status === "CLOSED").length;
  const openChecks = session.checks.filter((c) => c.status === "OPEN");
  const pendingTotal = openChecks.reduce((s, c) => s + Number(c.total), 0);
  const orderTotal = session.checks.reduce((s, c) => s + Number(c.total), 0);

  const filteredItems = useMemo(() => {
    return session.menuItems.filter((item) => {
      const catOk = categoryId === "all" || item.categoryId === categoryId;
      const q = search.trim().toLowerCase();
      return catOk && (!q || item.name.toLowerCase().includes(q));
    });
  }, [session.menuItems, categoryId, search]);

  function seatLabel(id: string | null) {
    if (!id) return "Toda la mesa";
    const seat = session.seats.find((s) => s.id === id);
    return seat?.displayName || seat?.label || "Persona";
  }

  function openModifiers(item: PosMenuItem) {
    setModifierItem(item);
    setQty(1);
    const defaults: string[] = [];
    for (const g of item.modifierGroups) {
      if (g.required && g.options[0]) defaults.push(g.options[0].id);
    }
    setSelectedMods(defaults);
  }

  function addItem(menuItemId: string, mods: string[], quantity: number) {
    if (!activeCheck || activeCheck.status !== "OPEN") return;
    startTransition(async () => {
      const result = await addOrderItemAction({
        checkId: activeCheck.id,
        menuItemId,
        quantity,
        modifierOptionIds: mods,
        seatId,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Agregado");
        setModifierItem(null);
      }
    });
  }

  function quickAdd(item: PosMenuItem) {
    if (item.modifierGroups.length > 0) {
      openModifiers(item);
      return;
    }
    addItem(item.id, [], 1);
  }

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-3 xl:flex-row">
      <section className="flex min-w-0 flex-[65] flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/pos"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Mesas
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">
              {session.tableName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {session.partySize ?? "—"} personas · {session.openMinutes} min
              {session.waiterName ? ` · Mesero: ${session.waiterName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await addSeatAction({
                    orderId: session.orderId,
                  });
                  if (!result.ok) toast.error(result.error);
                  else toast.success(result.message);
                })
              }
            >
              + Persona
            </Button>
            <Button variant="secondary" onClick={() => setSplitOpen(true)}>
              Dividir cuenta
            </Button>
          </div>
        </div>

        <InputSearch value={search} onChange={setSearch} />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip
            active={categoryId === "all"}
            onClick={() => setCategoryId("all")}
            label="Todo"
          />
          {session.categories.map((c) => (
            <Chip
              key={c.id}
              active={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
              label={c.name}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="rounded-xl border border-border bg-surface p-2 text-left transition hover:border-[var(--pub-blue)]"
              onClick={() => quickAdd(item)}
            >
              <div className="mb-2 aspect-[4/3] overflow-hidden rounded-lg bg-surface-secondary">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
              <p className="text-sm text-[var(--pub-blue)]">${item.price}</p>
            </button>
          ))}
        </div>
      </section>

      <aside className="flex w-full flex-col rounded-2xl border border-border bg-surface xl:w-[35%] xl:max-w-md">
        <div className="border-b border-border p-3">
          {session.checks.length > 1 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {session.checks.map((check) => {
                const label =
                  displayCheckName(check.name, session.checks.length) ??
                  "Cuenta";
                return (
                  <button
                    key={check.id}
                    type="button"
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium",
                      activeCheckId === check.id
                        ? "bg-[var(--pub-blue)] text-white"
                        : "bg-surface-secondary",
                    )}
                    onClick={() => setActiveCheckId(check.id)}
                  >
                    {label}
                    {check.status === "CLOSED" ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {closedCount} de {session.checks.length} pagadas · $
            {pendingTotal.toFixed(2)} pendiente
          </p>
        </div>

        <div className="border-b border-border p-3">
          <Label className="text-xs">Asignar a</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            <Chip
              active={seatId === null}
              onClick={() => setSeatId(null)}
              label="Toda la mesa"
            />
            {session.seats.map((s) => (
              <Chip
                key={s.id}
                active={seatId === s.id}
                onClick={() => setSeatId(s.id)}
                label={s.displayName || s.label}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {activeCheck?.items.length ? (
            activeCheck.items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border p-2 text-sm"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {item.quantity} × {item.nameSnapshot}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {seatLabel(item.seatId)}
                    </p>
                  </div>
                  <p className="font-semibold">${item.lineTotal}</p>
                </div>
                {activeCheck.status === "OPEN" ? (
                  <div className="mt-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await updateItemQtyAction({
                            orderItemId: item.id,
                            quantity: Math.max(1, item.quantity - 1),
                          });
                          if (!result.ok) toast.error(result.error);
                        })
                      }
                    >
                      −
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await updateItemQtyAction({
                            orderItemId: item.id,
                            quantity: item.quantity + 1,
                          });
                          if (!result.ok) toast.error(result.error);
                        })
                      }
                    >
                      +
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeOrderItemAction({
                            orderItemId: item.id,
                          });
                          if (!result.ok) toast.error(result.error);
                        })
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sin productos.</p>
          )}
        </div>

        <div className="sticky bottom-0 space-y-2 border-t border-border bg-surface p-3">
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>${activeCheck?.total ?? "0.00"}</span>
          </div>
          {activeCheck?.status === "OPEN" && Number(activeCheck.total) > 0 ? (
            <>
              <Button
                className="min-h-12 w-full"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await sendToKitchenAction({
                      checkId: activeCheck.id,
                    });
                    if (!result.ok) toast.error(result.error);
                    else toast.success(result.message);
                  })
                }
              >
                Enviar a cocina
              </Button>
              <Button
                className="min-h-12 w-full"
                variant="secondary"
                onClick={() => {
                  setPayCheckId(activeCheck.id);
                  setPayOpen(true);
                }}
              >
                Pagar ${activeCheck.total}
              </Button>
            </>
          ) : activeCheck?.status === "CLOSED" ? (
            <Link
              href={`/tickets/${activeCheck.id}`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-h-12 w-full",
              )}
            >
              Ver ticket
            </Link>
          ) : null}

          {session.checks.length > 1 ? (
            <div className="space-y-1 pt-1">
              {session.checks.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {displayCheckName(c.name, session.checks.length) ??
                      "Cuenta"}{" "}
                    · ${c.total}
                  </span>
                  {c.status === "OPEN" && Number(c.total) > 0 ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPayCheckId(c.id);
                        setPayOpen(true);
                      }}
                    >
                      Pagar
                    </Button>
                  ) : (
                    <Badge variant="secondary">Pagada</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {closedCount === session.checks.length &&
          session.checks.length > 0 ? (
            <Button
              className="min-h-12 w-full"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await endTableSessionAction({
                    orderId: session.orderId,
                  });
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success("Mesa cerrada");
                    router.push("/pos");
                  }
                })
              }
            >
              Cerrar mesa
            </Button>
          ) : null}
        </div>
      </aside>

      {payCheck ? (
        <PaymentSheet
          key={`${payCheck.id}-${payCheck.total}`}
          open={payOpen}
          onOpenChange={setPayOpen}
          checkId={payCheck.id}
          checkName={
            displayCheckName(payCheck.name, session.checks.length) ??
            "Cuenta de Mesa"
          }
          subtotal={payCheck.subtotal}
          discountTotal={payCheck.discountTotal}
          taxTotal={payCheck.taxTotal}
          total={payCheck.total}
        />
      ) : null}

      <SplitBillDrawer
        open={splitOpen}
        onOpenChange={setSplitOpen}
        orderId={session.orderId}
        total={orderTotal}
        partySize={session.partySize ?? session.seats.length}
        seatCount={session.seats.length}
      />

      <Sheet
        open={Boolean(modifierItem)}
        onOpenChange={(o) => {
          if (!o) setModifierItem(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{modifierItem?.name}</SheetTitle>
          </SheetHeader>
          {modifierItem ? (
            <div className="mt-4 space-y-4">
              {modifierItem.modifierGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <Label>
                    {group.name}
                    {group.required ? " *" : ""}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((opt) => {
                      const active = selectedMods.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={cn(
                            "min-h-11 rounded-xl px-3 text-sm",
                            active
                              ? "bg-[var(--pub-blue)] text-white"
                              : "bg-muted",
                          )}
                          onClick={() => {
                            setSelectedMods((prev) => {
                              const inGroup = group.options.map((o) => o.id);
                              const without = prev.filter(
                                (id) => !inGroup.includes(id),
                              );
                              const currently = prev.filter((id) =>
                                inGroup.includes(id),
                              );
                              if (currently.includes(opt.id)) {
                                return without.concat(
                                  currently.filter((id) => id !== opt.id),
                                );
                              }
                              if (group.maxSelections <= 1) {
                                return without.concat(opt.id);
                              }
                              if (currently.length >= group.maxSelections) {
                                return prev;
                              }
                              return without.concat([...currently, opt.id]);
                            });
                          }}
                        >
                          {opt.name}
                          {Number(opt.priceDelta) > 0
                            ? ` +$${opt.priceDelta}`
                            : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </Button>
                <span className="w-8 text-center text-lg font-semibold">
                  {qty}
                </span>
                <Button variant="outline" onClick={() => setQty((q) => q + 1)}>
                  +
                </Button>
              </div>
              <Button
                className="min-h-12 w-full"
                disabled={pending}
                onClick={() =>
                  addItem(modifierItem.id, selectedMods, qty)
                }
              >
                Agregar
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
        active
          ? "bg-[var(--pub-blue)] text-white"
          : "bg-surface-secondary text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function InputSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
      placeholder="Buscar producto…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
