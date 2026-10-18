"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toggleMenuItemAction } from "@/features/menu/actions";
import type { CategoryRow } from "@/features/menu/components/CategoriesPanel";

export type MenuItemRow = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  sku: string | null;
  price: string;
  available: boolean;
  active: boolean;
  imageUrl: string | null;
  modifierGroupCount: number;
  recipeCount: number;
};

type StatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "available"
  | "unavailable";

type Props = {
  items: MenuItemRow[];
  categories: CategoryRow[];
};

const PAGE_SIZE = 20;

export function MenuItemsTable({ items, categories }: Props) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [page, setPage] = useState(1);

  const categoryOptions = useMemo(() => {
    const ids = new Set(items.map((i) => i.categoryId));
    return categories
      .filter((c) => ids.has(c.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [categories, items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) {
        return false;
      }
      if (statusFilter === "active" && !item.active) return false;
      if (statusFilter === "inactive" && item.active) return false;
      if (statusFilter === "available" && !item.available) return false;
      if (statusFilter === "unavailable" && item.available) return false;

      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku ?? "").toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q)
      );
    });
  }, [items, query, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, statusFilter]);

  function toggle(
    id: string,
    patch: { available?: boolean; active?: boolean },
  ) {
    startTransition(async () => {
      const result = await toggleMenuItemAction({ id, ...patch });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Buscar</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, SKU, categoría…"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoría</Label>
          <select
            className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.active ? " (inactiva)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <select
            className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as StatusFilter)
            }
          >
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="available">Disponibles</option>
            <option value="unavailable">Agotados</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} de {items.length}
        {filtered.length !== items.length ? " (filtrados)" : ""}
      </p>

      {pageRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "No hay productos. Crea el primero para el POS."
            : "No hay productos con estos filtros."}
        </p>
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Mods / Receta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="size-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="size-10 rounded-md bg-muted" />
                      )}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.sku ?? "Sin SKU"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{item.categoryName}</TableCell>
                  <TableCell>${item.price}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant={item.available ? "default" : "secondary"}
                      >
                        {item.available ? "Disponible" : "Agotado"}
                      </Badge>
                      {!item.active ? (
                        <Badge variant="secondary">Inactivo</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.modifierGroupCount} grupos · {item.recipeCount}{" "}
                    insumos
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Link
                      href={`/menu/items/${item.id}`}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" }),
                      )}
                    >
                      Editar
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        toggle(item.id, { available: !item.available })
                      }
                    >
                      {item.available ? "Marcar agotado" : "Disponible"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        toggle(item.id, { active: !item.active })
                      }
                    >
                      {item.active ? "Desactivar" : "Activar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
    </div>
  );
}
