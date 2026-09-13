import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { checkPermission, requireUser } from "@/lib/rbac";

export default async function DashboardPage() {
  await requireUser();

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const [tablesTotal, tablesOccupied, lowStock, outOfStock, recentReviews, avgReview] =
    await Promise.all([
      location
        ? prisma.restaurantTable.count({
            where: { locationId: location.id, active: true },
          })
        : 0,
      location
        ? prisma.restaurantTable.count({
            where: {
              locationId: location.id,
              active: true,
              status: "OCCUPIED",
            },
          })
        : 0,
      location
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "Ingredient"
            WHERE "locationId" = ${location.id}
              AND active = true
              AND "currentStock" > 0
              AND "currentStock" < "minimumStock"
          `.then((r) => Number(r[0]?.count ?? 0))
        : 0,
      location
        ? prisma.ingredient.count({
            where: {
              locationId: location.id,
              active: true,
              currentStock: { lte: 0 },
            },
          })
        : 0,
      location
        ? prisma.review.findMany({
            where: { locationId: location.id },
            orderBy: { createdAt: "desc" },
            take: 3,
          })
        : [],
      location
        ? prisma.review.aggregate({
            where: { locationId: location.id },
            _avg: { overallRating: true },
          })
        : { _avg: { overallRating: null } },
    ]);

  const canSeeFinance = await checkPermission("finance", "read");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {location?.name ?? "Sin sucursal"} · estado operativo
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Ventas de hoy"
          value="—"
          hint="Disponible en Fase 5"
        />
        <MetricCard
          title="Mesas abiertas"
          value={`${tablesOccupied} / ${tablesTotal}`}
          hint="Ocupadas / total activas"
        />
        <MetricCard
          title="Ticket promedio"
          value="—"
          hint="Disponible en Fase 5"
        />
        <MetricCard
          title="Clientes atendidos"
          value="—"
          hint="Disponible con órdenes cerradas"
        />
        <MetricCard
          title="Por agotarse"
          value={String(lowStock)}
          hint="Stock bajo mínimo"
          tone={lowStock > 0 ? "warn" : "ok"}
        />
        <MetricCard
          title="Agotados"
          value={String(outOfStock)}
          hint="Stock en cero"
          tone={outOfStock > 0 ? "danger" : "ok"}
        />
        <MetricCard
          title="Pedidos por realizar"
          value="—"
          hint="Fase 6 — sugeridos"
        />
        <MetricCard
          title="Pedidos por recibir"
          value="—"
          hint="Fase 6 — POs abiertas"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reseñas recientes</CardTitle>
            <CardDescription>
              Promedio:{" "}
              {avgReview._avg.overallRating != null
                ? avgReview._avg.overallRating.toFixed(1)
                : "sin datos"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay reseñas. Módulo en Fase 8.
              </p>
            ) : (
              recentReviews.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0"
                >
                  <p className="text-sm">{r.comment ?? "Sin comentario"}</p>
                  <Badge variant="secondary">{r.overallRating}/5</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {canSeeFinance ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen financiero</CardTitle>
              <CardDescription>Visible solo con permiso finance</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <MetricMini label="Utilidad estimada" value="—" />
              <MetricMini label="Gastos del mes" value="—" />
              <MetricMini label="Nómina" value="—" />
              <MetricMini label="Valor inventario" value="—" />
              <p className="col-span-2 text-xs text-muted-foreground">
                Cálculos reales en Fase 9.{" "}
                <Link href="/finance" className="underline underline-offset-2">
                  Ir a Finanzas
                </Link>
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operación</CardTitle>
              <CardDescription>
                No tienes acceso al módulo financiero
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Usa POS, órdenes o inventario según tu rol.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
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
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
