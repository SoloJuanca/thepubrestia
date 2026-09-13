"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { ImageUploadField } from "@/features/menu/components/ImageUploadField";
import {
  ModifierGroupsEditor,
  groupsFromServer,
  serializeModifierGroups,
  type ModifierGroupDraft,
} from "@/features/menu/components/ModifierGroupsEditor";
import {
  createMenuItemAction,
  updateMenuItemAction,
} from "@/features/menu/actions";

type CategoryOption = { id: string; name: string };

type ItemInitial = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: string;
  estimatedCost: string | null;
  taxRate: string;
  imageUrl: string | null;
  imagePath: string | null;
  available: boolean;
  requiresPrep: boolean;
  estimatedPrepMins: number | null;
  tags: string[];
  active: boolean;
  modifierGroups: Array<{
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    options: Array<{
      name: string;
      priceDelta: number;
      active: boolean;
      sortOrder: number;
    }>;
  }>;
};

type Props = {
  mode: "create" | "edit";
  locationId: string;
  categories: CategoryOption[];
  blobEnabled: boolean;
  initial?: ItemInitial;
};

export function MenuItemForm({
  mode,
  locationId,
  categories,
  blobEnabled,
  initial,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    categoryId: initial?.categoryId ?? categories[0]?.id ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    sku: initial?.sku ?? "",
    price: initial?.price ?? "",
    estimatedCost: initial?.estimatedCost ?? "",
    taxRate: initial?.taxRate ?? "0.16",
    imageUrl: initial?.imageUrl ?? "",
    imagePath: initial?.imagePath ?? null,
    available: initial?.available ?? true,
    requiresPrep: initial?.requiresPrep ?? true,
    estimatedPrepMins:
      initial?.estimatedPrepMins != null
        ? String(initial.estimatedPrepMins)
        : "",
    tags: (initial?.tags ?? []).join(", "),
    active: initial?.active ?? true,
  });
  const [groups, setGroups] = useState<ModifierGroupDraft[]>(
    initial ? groupsFromServer(initial.modifierGroups) : [],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        locationId,
        categoryId: form.categoryId,
        name: form.name,
        description: form.description || null,
        sku: form.sku || null,
        price: Number(form.price),
        estimatedCost:
          form.estimatedCost === "" ? null : Number(form.estimatedCost),
        taxRate: Number(form.taxRate),
        imageUrl: form.imageUrl || null,
        imagePath: form.imagePath,
        available: form.available,
        requiresPrep: form.requiresPrep,
        estimatedPrepMins:
          form.estimatedPrepMins === ""
            ? null
            : Number(form.estimatedPrepMins),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        active: form.active,
        modifierGroups: serializeModifierGroups(groups),
      };

      const result =
        mode === "edit" && initial
          ? await updateMenuItemAction({ id: initial.id, ...payload })
          : await createMenuItemAction(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
      if (mode === "create" && result.id) {
        router.push(`/menu/items/${result.id}`);
      } else {
        router.push("/menu");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "create" ? "Nuevo producto" : "Editar producto"}
          </CardTitle>
          <CardDescription>
            Precio, impuestos, disponibilidad y modificadores.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item-name">Nombre</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item-desc">Descripción</Label>
            <Textarea
              id="item-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-category">Categoría</Label>
            <select
              id="item-category"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.categoryId}
              onChange={(e) =>
                setForm({ ...form, categoryId: e.target.value })
              }
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-sku">SKU (opcional)</Label>
            <Input
              id="item-sku"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-price">Precio</Label>
            <Input
              id="item-price"
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-cost">Costo estimado</Label>
            <Input
              id="item-cost"
              type="number"
              min={0}
              step="0.01"
              value={form.estimatedCost}
              onChange={(e) =>
                setForm({ ...form, estimatedCost: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-tax">Impuesto (ej. 0.16)</Label>
            <Input
              id="item-tax"
              type="number"
              min={0}
              max={1}
              step="0.01"
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-prep">Minutos de prep.</Label>
            <Input
              id="item-prep"
              type="number"
              min={0}
              value={form.estimatedPrepMins}
              onChange={(e) =>
                setForm({ ...form, estimatedPrepMins: e.target.value })
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item-tags">Tags (separados por coma)</Label>
            <Input
              id="item-tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="spicy, vegan"
            />
          </div>
          <div className="sm:col-span-2">
            <ImageUploadField
              blobEnabled={blobEnabled}
              folder="menu/items"
              imageUrl={form.imageUrl || null}
              imagePath={form.imagePath}
              onChange={({ imageUrl, imagePath }) =>
                setForm({ ...form, imageUrl, imagePath })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) =>
                setForm({ ...form, available: e.target.checked })
              }
            />
            Disponible en POS
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresPrep}
              onChange={(e) =>
                setForm({ ...form, requiresPrep: e.target.checked })
              }
            />
            Requiere preparación
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Activo (no eliminado)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customización</CardTitle>
        </CardHeader>
        <CardContent>
          <ModifierGroupsEditor groups={groups} onChange={setGroups} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !form.categoryId}>
          {pending ? "Guardando…" : "Guardar producto"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/menu")}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
