import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  purchaseOrderService,
  weekdayToday,
} from "@/services/purchase-order.service";
import { SuppliersAdminView } from "@/features/suppliers/components/SuppliersAdminView";
import { WEEKDAY_LABELS } from "@/features/purchases/labels";

export default async function SuppliersPage() {
  await requirePermission("suppliers", "read");
  const canWrite =
    (await checkPermission("suppliers", "create")) ||
    (await checkPermission("suppliers", "update"));

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          No hay sucursal activa. Ejecuta el seed.
        </p>
      </div>
    );
  }

  const [suppliers, dueToday, ingredients] = await Promise.all([
    prisma.supplier.findMany({
      where: { locationId: location.id },
      include: {
        schedules: true,
        products: {
          include: { ingredient: true },
          orderBy: { ingredient: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    }),
    purchaseOrderService.suppliersDueToday(location.id),
    prisma.ingredient.findMany({
      where: { locationId: location.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <SuppliersAdminView
      locationId={location.id}
      canWrite={canWrite}
      todayLabel={WEEKDAY_LABELS[weekdayToday()] ?? weekdayToday()}
      dueToday={dueToday.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        whatsapp: s.whatsapp,
        deliveries: s.schedules.map((sch) => sch.deliveryDay),
        productCount: s.products.length,
      }))}
      ingredients={ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        baseUnit: i.baseUnit,
        averageCost: Number(i.averageCost).toFixed(4),
      }))}
      suppliers={suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        contact: s.contact,
        phone: s.phone,
        whatsapp: s.whatsapp,
        email: s.email,
        notes: s.notes,
        active: s.active,
        schedules: s.schedules.map((sch) => ({
          orderDay: sch.orderDay,
          deliveryDay: sch.deliveryDay,
        })),
        products: s.products.map((p) => ({
          id: p.id,
          ingredientId: p.ingredientId,
          ingredientName: p.ingredient.name,
          supplierSku: p.supplierSku,
          unit: p.unit,
          unitCost: Number(p.unitCost).toFixed(4),
          minOrderQty:
            p.minOrderQty != null ? Number(p.minOrderQty).toString() : null,
          active: p.active,
        })),
      }))}
    />
  );
}
