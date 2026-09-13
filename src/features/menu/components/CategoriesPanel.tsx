"use client";

import { useState, useTransition } from "react";
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
  createCategoryAction,
  updateCategoryAction,
} from "@/features/menu/actions";

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  sortOrder: number;
  active: boolean;
  itemCount: number;
};

type Props = {
  locationId: string;
  blobEnabled: boolean;
  categories: CategoryRow[];
};

export function CategoriesPanel({ locationId, blobEnabled, categories }: Props) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    description: "",
    sortOrder: String(categories.length + 1),
    imageUrl: "",
    imagePath: null as string | null,
    active: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      sortOrder: String(categories.length + 1),
      imageUrl: "",
      imagePath: null,
      active: true,
    });
  }

  function startEdit(cat: CategoryRow) {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      description: cat.description ?? "",
      sortOrder: String(cat.sortOrder),
      imageUrl: cat.imageUrl ?? "",
      imagePath: cat.imagePath,
      active: cat.active,
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        locationId,
        name: form.name,
        description: form.description || null,
        sortOrder: Number(form.sortOrder) || 0,
        imageUrl: form.imageUrl || null,
        imagePath: form.imagePath,
        active: form.active,
      };

      const result = editingId
        ? await updateCategoryAction({ id: editingId, ...payload })
        : await createCategoryAction(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      resetForm();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Editar categoría" : "Nueva categoría"}
          </CardTitle>
          <CardDescription>
            Orden, imagen y activación sin eliminar histórico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nombre</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Descripción</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-order">Orden</Label>
              <Input
                id="cat-order"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: e.target.value })
                }
              />
            </div>
            <ImageUploadField
              blobEnabled={blobEnabled}
              folder="menu/categories"
              imageUrl={form.imageUrl || null}
              imagePath={form.imagePath}
              onChange={({ imageUrl, imagePath }) =>
                setForm({ ...form, imageUrl, imagePath })
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              Activa
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Guardando…"
                  : editingId
                    ? "Actualizar"
                    : "Crear"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={pending}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorías</CardTitle>
          <CardDescription>{categories.length} en esta sucursal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay categorías.
            </p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 rounded-lg border border-border/70 p-3"
              >
                {cat.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cat.imageUrl}
                    alt=""
                    className="size-12 rounded-md object-cover"
                  />
                ) : (
                  <div className="size-12 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Orden {cat.sortOrder} · {cat.itemCount} productos ·{" "}
                    {cat.active ? "Activa" : "Inactiva"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(cat)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await updateCategoryAction({
                          id: cat.id,
                          active: !cat.active,
                        });
                        if (!result.ok) toast.error(result.error);
                        else toast.success("Estado actualizado");
                      })
                    }
                  >
                    {cat.active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
