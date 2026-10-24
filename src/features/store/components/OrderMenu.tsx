"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { placeWebOrderAction } from "@/features/store/actions";
import type { PublicCategory, PublicMenuItem } from "@/features/store/menu";

type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  quantity: number;
  modifierOptionIds: string[];
  modifierLabels: string[];
  unitPrice: number;
  notes?: string;
};

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function lineKey(menuItemId: string, modifierOptionIds: string[]) {
  return `${menuItemId}:${[...modifierOptionIds].sort().join(",")}`;
}

export function OrderMenu({ categories }: { categories: PublicCategory[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [draft, setDraft] = useState<PublicMenuItem | null>(null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [draftNote, setDraftNote] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [orderNote, setOrderNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const active = categories.find((category) => category.id === activeId) ?? categories[0];
  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  const draftPrice = useMemo(() => {
    if (!draft) return 0;
    const extra = draft.modifierGroups.reduce((sum, group) => {
      const ids = picked[group.id] ?? [];
      return (
        sum +
        group.options
          .filter((option) => ids.includes(option.id))
          .reduce((inner, option) => inner + option.priceDelta, 0)
      );
    }, 0);
    return draft.price + extra;
  }, [draft, picked]);

  function openItem(item: PublicMenuItem) {
    if (item.modifierGroups.length === 0) {
      addLine(item, [], "");
      return;
    }
    setDraft(item);
    setPicked({});
    setDraftNote("");
    setDraftError(null);
  }

  function toggleOption(groupId: string, optionId: string, max: number) {
    setPicked((current) => {
      const selected = current[groupId] ?? [];
      if (selected.includes(optionId)) {
        return { ...current, [groupId]: selected.filter((id) => id !== optionId) };
      }
      if (max <= 1) return { ...current, [groupId]: [optionId] };
      if (selected.length >= max) return current;
      return { ...current, [groupId]: [...selected, optionId] };
    });
  }

  function addLine(item: PublicMenuItem, modifierOptionIds: string[], notes: string) {
    const labels = item.modifierGroups.flatMap((group) =>
      group.options
        .filter((option) => modifierOptionIds.includes(option.id))
        .map((option) => option.name),
    );
    const extra = item.modifierGroups.reduce((sum, group) => {
      return (
        sum +
        group.options
          .filter((option) => modifierOptionIds.includes(option.id))
          .reduce((inner, option) => inner + option.priceDelta, 0)
      );
    }, 0);
    const key = lineKey(item.id, modifierOptionIds);
    setCart((current) => {
      const existing = current.find((line) => line.key === key && !notes);
      if (existing && !notes) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(20, line.quantity + 1) }
            : line,
        );
      }
      return [
        ...current,
        {
          key: notes ? `${key}:${current.length}` : key,
          menuItemId: item.id,
          name: item.name,
          quantity: 1,
          modifierOptionIds,
          modifierLabels: labels,
          unitPrice: item.price + extra,
          notes: notes || undefined,
        },
      ];
    });
    setDraft(null);
  }

  function confirmDraft() {
    if (!draft) return;
    for (const group of draft.modifierGroups) {
      const countPicked = (picked[group.id] ?? []).length;
      const minimum = Math.max(group.minSelections, group.required ? 1 : 0);
      if (countPicked < minimum) {
        setDraftError(
          minimum === 1
            ? `Elige una opción de ${group.name}.`
            : `${group.name} necesita al menos ${minimum}.`,
        );
        return;
      }
      if (countPicked > group.maxSelections) {
        setDraftError(`${group.name} permite máximo ${group.maxSelections}.`);
        return;
      }
    }
    const ids = draft.modifierGroups.flatMap((group) => picked[group.id] ?? []);
    addLine(draft, ids, draftNote.trim());
  }

  async function submitOrder() {
    if (!cart.length || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await placeWebOrderAction({
        note: orderNote,
        lines: cart.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          modifierOptionIds: line.modifierOptionIds,
          notes: line.notes,
        })),
      });
      if (!result.ok || !result.id) {
        setError(result.ok ? "No se pudo enviar el pedido." : result.error);
        setPending(false);
        return;
      }
      router.push(`/pedir/listo/${result.id}`);
    } catch {
      setError("No se pudo enviar el pedido. Intenta de nuevo.");
      setPending(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorías">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={category.id === active?.id}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                category.id === active?.id
                  ? "border-[var(--pub-blue)] bg-[var(--pub-blue)] text-white"
                  : "border-border bg-background hover:bg-muted"
              }`}
              onClick={() => setActiveId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {(active?.items ?? []).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                className="flex h-full w-full gap-3 rounded-xl border border-border bg-card p-3 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pub-blue)]"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    Pub
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.name}</span>
                  {item.description ? (
                    <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  ) : null}
                  <span className="mt-2 block text-sm font-semibold text-[var(--pub-blue-dark)]">
                    {money(item.price)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside
        id="carrito"
        className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-20"
        aria-label="Tu pedido"
      >
        <h2 className="text-base font-semibold">Tu pedido</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lo prepara la cocina y pagas al recoger.
        </p>
        {cart.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Todavía no agregas productos.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {cart.map((line) => (
              <li key={line.key} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {line.quantity} × {line.name}
                  </p>
                  {line.modifierLabels.length ? (
                    <p className="text-muted-foreground">{line.modifierLabels.join(", ")}</p>
                  ) : null}
                  {line.notes ? (
                    <p className="text-muted-foreground">Nota: {line.notes}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-medium">{money(line.unitPrice * line.quantity)}</p>
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() =>
                      setCart((current) => current.filter((item) => item.key !== line.key))
                    }
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-4 block text-sm font-medium" htmlFor="order-note">
          Nota para el pedido
        </label>
        <Textarea
          id="order-note"
          value={orderNote}
          maxLength={240}
          placeholder="Ej. paso en 20 minutos"
          className="mt-2"
          onChange={(event) => setOrderNote(event.target.value)}
        />
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>{count} producto(s)</span>
          <span className="text-base font-semibold">{money(total)}</span>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-4 h-11 w-full"
          disabled={!cart.length || pending}
          onClick={submitOrder}
        >
          {pending ? "Enviando…" : "Enviar a cocina"}
        </Button>
      </aside>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          {draft ? (
            <>
              <DialogHeader>
                <DialogTitle>{draft.name}</DialogTitle>
                <DialogDescription>
                  {draft.description || "Elige las opciones de este producto."}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-80 space-y-4 overflow-y-auto">
                {draft.modifierGroups.map((group) => (
                  <fieldset key={group.id} className="space-y-2">
                    <legend className="text-sm font-medium">
                      {group.name}
                      <span className="ml-1 font-normal text-muted-foreground">
                        {group.required ? "· obligatorio" : "· opcional"}
                      </span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const selected = (picked[group.id] ?? []).includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={selected}
                            className={`rounded-full border px-3 py-1.5 text-sm ${
                              selected
                                ? "border-[var(--pub-blue)] bg-[var(--pub-blue)] text-white"
                                : "border-border hover:bg-muted"
                            }`}
                            onClick={() =>
                              toggleOption(group.id, option.id, group.maxSelections)
                            }
                          >
                            {option.name}
                            {option.priceDelta
                              ? ` (${option.priceDelta > 0 ? "+" : ""}${money(option.priceDelta)})`
                              : ""}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
                <label className="block text-sm font-medium" htmlFor="item-note">
                  Nota de este producto
                </label>
                <Textarea
                  id="item-note"
                  value={draftNote}
                  maxLength={160}
                  onChange={(event) => setDraftNote(event.target.value)}
                />
              </div>
              {draftError ? (
                <p className="text-sm text-destructive" role="alert">
                  {draftError}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="button" className="h-10" onClick={confirmDraft}>
                  Agregar · {money(draftPrice)}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
