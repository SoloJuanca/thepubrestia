"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { UNIT_LABELS } from "@/features/inventory/labels";
import type { IngredientRow } from "@/features/inventory/components/IngredientsPanel";
import { cn } from "@/lib/utils";

type Props = {
  ingredients: IngredientRow[];
  lowCount: number;
  outCount: number;
  suggestedCount: number;
  inventoryValue: number;
};

function stockStatus(row: IngredientRow): "OK" | "BAJO" | "AGOTADO" {
  const stock = Number(row.currentStock);
  const min = Number(row.minimumStock);
  if (stock <= 0) return "AGOTADO";
  if (stock < min) return "BAJO";
  return "OK";
}

export function InventoryStatusPanel({
  ingredients,
  lowCount,
  outCount,
  suggestedCount,
  inventoryValue,
}: Props) {
  function addToNextOrder(name: string) {
    toast.success(`${name} listo para el próximo pedido`, {
      action: {
        label: "Ir a pedidos",
        onClick: () => {
          window.location.href = "/purchases";
        },
      },
      description: "Revisa la sección Necesitamos pedir.",
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Valor inventario"
          value={`$${inventoryValue.toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        />
        <SummaryCard
          title="Stock bajo"
          value={String(lowCount)}
          tone={lowCount > 0 ? "warn" : "ok"}
        />
        <SummaryCard
          title="Agotados"
          value={String(outCount)}
          tone={outCount > 0 ? "danger" : "ok"}
        />
        <SummaryCard
          title="Pedidos sugeridos"
          value={String(suggestedCount)}
          tone={suggestedCount > 0 ? "warn" : "ok"}
        />
      </div>

      <Card className="border-[var(--pub-blue)]/25">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ingredientes</CardTitle>
          <CardDescription>
            Stock actual, mínimo y proveedor preferido.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Mín</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay ingredientes. Crea uno en la pestaña Ingredientes.
                  </TableCell>
                </TableRow>
              ) : (
                ingredients.map((row) => {
                  const status = stockStatus(row);
                  const low = status !== "OK";
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
                          {UNIT_LABELS[row.baseUnit] ?? row.baseUnit}
                        </p>
                      </TableCell>
                      <TableCell>{row.currentStock}</TableCell>
                      <TableCell>{row.minimumStock}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "AGOTADO"
                              ? "destructive"
                              : status === "BAJO"
                                ? "secondary"
                                : "outline"
                          }
                          className={cn(
                            status === "OK" &&
                              "border-[var(--pub-blue)]/40 text-[var(--pub-blue-dark)]",
                          )}
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.preferredSupplierName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {low ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[var(--pub-blue)]/40"
                            onClick={() => addToNextOrder(row.name)}
                          >
                            Agregar al próximo pedido
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle
          className={
            tone === "danger"
              ? "text-2xl text-destructive"
              : tone === "warn"
                ? "text-2xl text-amber-700"
                : "text-2xl"
          }
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
