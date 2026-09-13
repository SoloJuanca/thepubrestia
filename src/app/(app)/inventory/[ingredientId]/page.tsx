import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
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
  MOVEMENT_TYPE_LABELS,
  UNIT_LABELS,
} from "@/features/inventory/labels";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ ingredientId: string }> };

function stockStatusLabel(
  current: number,
  minimum: number,
): { label: string; tone: "ok" | "warn" | "danger" } {
  if (current <= 0) return { label: "AGOTADO", tone: "danger" };
  if (current < minimum) return { label: "BAJO", tone: "warn" };
  return { label: "OK", tone: "ok" };
}

export default async function IngredientDetailPage({ params }: Props) {
  await requirePermission("inventory", "read");
  const { ingredientId } = await params;

  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    include: {
      preferredSupplier: true,
      recipeItems: {
        include: {
          menuItem: {
            include: { category: true },
          },
        },
        orderBy: { menuItem: { name: "asc" } },
      },
      movements: {
        include: { employee: true },
        orderBy: { createdAt: "desc" },
        take: 40,
      },
    },
  });

  if (!ingredient) notFound();

  const current = Number(ingredient.currentStock);
  const minimum = Number(ingredient.minimumStock);
  const ideal =
    ingredient.targetStock != null ? Number(ingredient.targetStock) : null;
  const status = stockStatusLabel(current, minimum);
  const unit = UNIT_LABELS[ingredient.baseUnit] ?? ingredient.baseUnit;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/inventory"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver al inventario
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {ingredient.name}
          </h1>
          <Badge
            variant={
              status.tone === "danger"
                ? "destructive"
                : status.tone === "warn"
                  ? "secondary"
                  : "outline"
            }
            className={cn(
              status.tone === "ok" &&
                "border-[var(--pub-blue)]/40 text-[var(--pub-blue-dark)]",
            )}
          >
            {status.label}
          </Badge>
          {!ingredient.active ? (
            <Badge variant="secondary">Inactivo</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {ingredient.category ?? "Sin categoría"} · Unidad base: {unit}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Stock actual"
          value={`${current} ${unit}`}
          highlight
        />
        <MetricCard title="Stock mínimo" value={`${minimum} ${unit}`} />
        <MetricCard
          title="Stock ideal"
          value={ideal != null ? `${ideal} ${unit}` : "—"}
        />
        <MetricCard
          title="Costo promedio"
          value={`$${Number(ingredient.averageCost).toFixed(4)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proveedor preferido</CardTitle>
        </CardHeader>
        <CardContent>
          {ingredient.preferredSupplier ? (
            <p className="text-sm font-medium">
              {ingredient.preferredSupplier.name}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin proveedor preferido asignado.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recetas que lo usan</CardTitle>
          <CardDescription>
            Platillos del menú que incluyen este ingrediente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ingredient.recipeItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguna receta usa este ingrediente.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {ingredient.recipeItems.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{r.menuItem.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.menuItem.category.name}
                    </p>
                  </div>
                  <span className="text-muted-foreground">
                    {Number(r.quantity)} {UNIT_LABELS[r.unit] ?? r.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos recientes</CardTitle>
          <CardDescription>
            Últimos registros de inventario para este insumo.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {ingredient.movements.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Aún no hay movimientos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Antes → Después</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredient.movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(m.createdAt, "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {MOVEMENT_TYPE_LABELS[m.movementType] ??
                          m.movementType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {Number(m.quantity) > 0 ? "+" : ""}
                      {Number(m.quantity)} {unit}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Number(m.previousStock)} → {Number(m.resultingStock)}
                    </TableCell>
                    <TableCell>
                      {m.employee?.name ?? m.employee?.email ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                      {m.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  highlight,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={highlight ? "border-[var(--pub-blue)]/40" : undefined}
    >
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
