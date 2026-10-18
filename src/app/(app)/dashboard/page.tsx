import { prisma } from "@/lib/prisma";
import { requireUser, flattenPermissions } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { inventoryService } from "@/services/inventory.service";
import { purchaseOrderService } from "@/services/purchase-order.service";
import {
  hubPathsForPersona,
  resolveRolePersona,
  type RolePersona,
} from "@/lib/role-home";
import {
  RoleHomeView,
  type HomeAttention,
  type HomeMetric,
} from "@/features/home/components/RoleHomeView";

export default async function DashboardPage() {
  const user = await requireUser();
  const roles = user.roles.map((r) => r.role.code);
  const persona = resolveRolePersona(roles);
  const permissions = flattenPermissions(user);

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const needFloor =
    persona === "waiter" ||
    persona === "cashier" ||
    persona === "manager" ||
    persona === "admin";
  const needSales = persona === "manager" || persona === "admin" || persona === "cashier";
  const needStock =
    persona === "inventory" ||
    persona === "manager" ||
    persona === "admin";
  const needPurchases =
    persona === "inventory" ||
    persona === "manager" ||
    persona === "admin";
  const needServices = persona === "manager" || persona === "admin";
  const needAttendanceAlert = persona === "manager" || persona === "admin";

  const [
    tablesOccupied,
    tablesTotal,
    tablesAwaiting,
    salesToday,
    peopleToday,
    alerts,
    openPOs,
    dueSuppliers,
    lateToday,
    overdueServices,
  ] = await Promise.all([
    needFloor && location
      ? prisma.restaurantTable.count({
          where: {
            locationId: location.id,
            active: true,
            status: { in: ["OCCUPIED", "AWAITING_PAYMENT"] },
          },
        })
      : Promise.resolve(0),
    needFloor && location
      ? prisma.restaurantTable.count({
          where: { locationId: location.id, active: true },
        })
      : Promise.resolve(0),
    needFloor && location
      ? prisma.restaurantTable.count({
          where: {
            locationId: location.id,
            active: true,
            status: "AWAITING_PAYMENT",
          },
        })
      : Promise.resolve(0),
    needSales && location
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
      : Promise.resolve(0),
    needFloor && location
      ? prisma.order
          .aggregate({
            where: {
              locationId: location.id,
              openedAt: { gte: start },
              status: { not: "CANCELLED" },
            },
            _sum: { partySize: true },
          })
          .then((r) => r._sum.partySize ?? 0)
      : Promise.resolve(0),
    needStock && location
      ? inventoryService.getStockAlerts(location.id)
      : Promise.resolve(null),
    needPurchases && location
      ? prisma.purchaseOrder.count({
          where: {
            locationId: location.id,
            status: { in: ["PENDING", "ORDERED", "PARTIALLY_RECEIVED"] },
          },
        })
      : Promise.resolve(0),
    needPurchases && location
      ? purchaseOrderService.suppliersDueToday(location.id)
      : Promise.resolve([]),
    needAttendanceAlert && location
      ? prisma.employeeAttendance.count({
          where: {
            locationId: location.id,
            checkInAt: { gte: start },
            status: "LATE",
          },
        })
      : Promise.resolve(0),
    needServices && location
      ? prisma.service.count({
          where: {
            locationId: location.id,
            status: "ACTIVE",
            nextServiceDate: { lt: start },
          },
        })
      : Promise.resolve(0),
  ]);

  const paths = hubPathsForPersona(persona).filter((p) => {
    if (!p.resource) return true;
    return hasPermission(
      permissions,
      p.resource as Parameters<typeof hasPermission>[1],
      "read",
    );
  });

  const metrics = buildMetrics(persona, {
    salesToday,
    tablesOccupied,
    tablesTotal,
    tablesAwaiting,
    peopleToday,
    low: alerts?.low.length ?? 0,
    out: alerts?.out.length ?? 0,
    openPOs,
  });

  const attention = buildAttention(persona, {
    low: alerts?.low.length ?? 0,
    out: alerts?.out.length ?? 0,
    dueCount: dueSuppliers.length,
    overdueServices,
    lateToday,
    tablesAwaiting,
  });

  return (
    <RoleHomeView
      persona={persona}
      locationName={location?.name ?? "Sin sucursal"}
      paths={paths}
      metrics={metrics}
      attention={attention}
    />
  );
}

function buildMetrics(
  persona: RolePersona,
  data: {
    salesToday: number;
    tablesOccupied: number;
    tablesTotal: number;
    tablesAwaiting: number;
    peopleToday: number;
    low: number;
    out: number;
    openPOs: number;
  },
): HomeMetric[] {
  if (persona === "kitchen") return [];
  if (persona === "waiter") {
    return [
      {
        title: "Mesas abiertas",
        value: `${data.tablesOccupied} / ${data.tablesTotal}`,
      },
      { title: "Personas hoy", value: String(data.peopleToday) },
    ];
  }
  if (persona === "cashier") {
    return [
      { title: "Ventas hoy", value: `$${data.salesToday.toFixed(2)}` },
      { title: "Por cobrar", value: String(data.tablesAwaiting) },
      {
        title: "Mesas abiertas",
        value: `${data.tablesOccupied} / ${data.tablesTotal}`,
      },
    ];
  }
  if (persona === "inventory") {
    return [
      {
        title: "Stock bajo / agotado",
        value: String(data.low + data.out),
      },
      { title: "Pedidos abiertos", value: String(data.openPOs) },
    ];
  }
  return [
    { title: "Ventas", value: `$${data.salesToday.toFixed(2)}` },
    {
      title: "Mesas abiertas",
      value: `${data.tablesOccupied} / ${data.tablesTotal}`,
    },
    { title: "Personas atendidas", value: String(data.peopleToday) },
  ];
}

function buildAttention(
  persona: RolePersona,
  data: {
    low: number;
    out: number;
    dueCount: number;
    overdueServices: number;
    lateToday: number;
    tablesAwaiting: number;
  },
): HomeAttention[] {
  const attention: HomeAttention[] = [];
  if (
    (persona === "cashier" || persona === "manager" || persona === "admin") &&
    data.tablesAwaiting > 0
  ) {
    attention.push({
      text: `${data.tablesAwaiting} mesa(s) por cobrar`,
      href: "/pos",
    });
  }
  if (
    (persona === "inventory" ||
      persona === "manager" ||
      persona === "admin") &&
    data.low + data.out > 0
  ) {
    attention.push({
      text: `${data.low + data.out} productos con stock bajo o agotados`,
      href: "/inventory",
    });
  }
  if (
    (persona === "inventory" ||
      persona === "manager" ||
      persona === "admin") &&
    data.dueCount > 0
  ) {
    attention.push({
      text: `${data.dueCount} pedidos deben realizarse hoy`,
      href: "/purchases",
    });
  }
  if (
    (persona === "manager" || persona === "admin") &&
    data.overdueServices > 0
  ) {
    attention.push({
      text: `${data.overdueServices} servicios vencidos`,
      href: "/services",
    });
  }
  if ((persona === "manager" || persona === "admin") && data.lateToday > 0) {
    attention.push({
      text: `${data.lateToday} empleado(s) con retardo hoy`,
      href: "/attendance",
    });
  }
  return attention;
}
