"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

export type MenuItemRow = {
  id: string;
  name: string;
  categoryName: string;
  sku: string | null;
  price: string;
  available: boolean;
  active: boolean;
  imageUrl: string | null;
  modifierGroupCount: number;
  recipeCount: number;
};

type Props = {
  items: MenuItemRow[];
};

export function MenuItemsTable({ items }: Props) {
  const [pending, startTransition] = useTransition();

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

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No hay productos. Crea el primero para el POS.
      </p>
    );
  }

  return (
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
          {items.map((item) => (
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
                  <Badge variant={item.available ? "default" : "secondary"}>
                    {item.available ? "Disponible" : "Agotado"}
                  </Badge>
                  {!item.active ? (
                    <Badge variant="secondary">Inactivo</Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.modifierGroupCount} grupos · {item.recipeCount} insumos
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
                  onClick={() => toggle(item.id, { active: !item.active })}
                >
                  {item.active ? "Desactivar" : "Activar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
