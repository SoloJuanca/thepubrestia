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
import { requireUser, checkPermission } from "@/lib/rbac";
import { inventoryService } from "@/services/inventory.service";
import { purchaseOrderService, weekdayToday } from "@/services/purchase-order.service";
import { WEEKDAY_LABELS } from "@/features/purchases/labels";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  await requireUser();

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [
    tablesOccupied,
    tablesTotal,
    salesToday,
    peopleToday,
    alerts,
    openPOs,
    dueSuppliers,
    lateToday,
    upcomingServices,
    overdueServices,
  ] = await Promise.all([
    location
      ? prisma.restaurantTable.count({
          where: {
            locationId: location.id,
            active: true,
            status: { in: ["OCCUPIED", "AWAITING_PAYMENT"] },
          },
        })
      : 0,
    location
      ? prisma.restaurantTable.count({
          where: { locationId: location.id, active: true },
        })
      : 0,
    location
      ? prisma.check
          .aggregate({
            where: {
              status: "CLOSED",
              closedAt: { gte: start },
              order: { locationId: location.id },
            },
            _sum: { total: true },
          })
          .then((r) => Number(r._sum.total ?? 0))
      : 0,
    location
      ? prisma.order.aggregate({
          where: {
            locationId: location.id,
            openedAt: { gte: start },
            status: { not: "CANCELLED" },
          },
          _sum: { partySize: true },
        }).then((r) => r._sum.partySize ?? 0)
      : 0,
    location ? inventoryService.getStockAlerts(location.id) : null,
    location
      ? prisma.purchaseOrder.count({
          where: {
            locationId: location.id,
            status: { in: ["PENDING", "ORDERED", "PARTIALLY_RECEIVED"] },
          },
        })
      : 0,
    location ? purchaseOrderService.suppliersDueToday(location.id) : [],
    location
      ? prisma.employeeAttendance.count({
          where: {
            locationId: location.id,
            checkInAt: { gte: start },
            status: "LATE",
          },
        })
      : 0,
    location
      ? prisma.service.findMany({
          where: {
            locationId: location.id,
            status: "ACTIVE",
            nextServiceDate: {
              gte: start,
              lte: new Date(Date.now() + 7 * 86400000),
            },
          },
          orderBy: { nextServiceDate: "asc" },
          take: 5,
        })
      : [],
    location
      ? prisma.service.findMany({
          where: {
            locationId: location.id,
            status: "ACTIVE",
            nextServiceDate: { lt: start },
          },
          orderBy: { nextServiceDate: "asc" },
          take: 5,
        })
      : [],
  ]);

  const low = alerts?.low.length ?? 0;
  const out = alerts?.out.length ?? 0;
  const suggested = alerts?.suggested.length ?? 0;
  const canFinance = await checkPermission("finance", "read");

  const attention: Array<{ text: string; href: string }> = [];
  if (low + out > 0) {
    attention.push({
      text: `${low + out} productos con stock bajo o agotados`,
      href: "/inventory",
    });
  }
  if (dueSuppliers.length > 0) {
    attention.push({
      text: `${dueSuppliers.length} pedidos deben realizarse hoy`,
      href: "/purchases",
    });
  }
  if (overdueServices.length > 0) {
    attention.push({
      text: `${overdueServices.length} servicios vencidos`,
      href: "/services",
    });
  }
  if (lateToday > 0) {
    attention.push({
      text: `${lateToday} empleado(s) con retardo hoy`,
      href: "/attendance",
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {location?.name ?? "Sin sucursal"} · operación de hoy
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Hoy
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric title="Ventas" value={`$${salesToday.toFixed(2)}`} />
          <Metric
            title="Mesas abiertas"
            value={`${tablesOccupied} / ${tablesTotal}`}
          />
          <Metric title="Personas atendidas" value={String(peopleToday)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Necesita atención
        </h2>
        {attention.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Todo en orden por ahora.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {attention.map((a) => (
              <Link
                key={a.href + a.text}
                href={a.href}
                className="flex items-center justify-between rounded-xl border border-[var(--warning)]/40 bg-surface px-4 py-3 text-sm hover:bg-surface-secondary"
              >
                <span>{a.text}</span>
                <Badge variant="secondary">Ver</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Próximamente
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pedidos / proveedores</CardTitle>
              <CardDescription>
                Hoy es {WEEKDAY_LABELS[weekdayToday()]}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {dueSuppliers.length === 0 ? (
                <p className="text-muted-foreground">Sin pedidos programados hoy.</p>
              ) : (
                dueSuppliers.map((s) => (
                  <Link
                    key={s.id}
                    href="/suppliers"
                    className="block rounded-lg border border-border px-3 py-2 hover:bg-muted/40"
                  >
                    {s.name} · pedir hoy
                  </Link>
                ))
              )}
              <p className="text-muted-foreground">
                {openPOs} pedidos por recibir · {suggested} sugeridos
              </p>
              <Link
                href="/purchases"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Ir a pedidos
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mantenimiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[...overdueServices, ...upcomingServices].length === 0 ? (
                <p className="text-muted-foreground">Sin servicios próximos.</p>
              ) : (
                [...overdueServices, ...upcomingServices].slice(0, 5).map((s) => (
                  <Link
                    key={s.id}
                    href="/services"
                    className="flex justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/40"
                  >
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">
                      {s.nextServiceDate
                        ? s.nextServiceDate.toLocaleDateString("es-MX")
                        : "—"}
                    </span>
                  </Link>
                ))
              )}
              {canFinance ? (
                <Link
                  href="/finance"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Finanzas
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
