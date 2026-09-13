import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { inventoryService } from "@/services/inventory.service";
import { PurchasesAdminView } from "@/features/purchases/components/PurchasesAdminView";

export default async function PurchasesPage() {
  await requirePermission("purchases", "read");
  const canWrite =
    (await checkPermission("purchases", "create")) ||
    (await checkPermission("purchases", "update"));
  const canReceive =
    canWrite && (await checkPermission("inventory", "adjust"));

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          No hay sucursal activa. Ejecuta el seed.
        </p>
      </div>
    );
  }

  const [orders, suppliers, alerts] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { locationId: location.id },
      include: {
        supplier: true,
        items: {
          include: { ingredient: true },
          orderBy: { ingredient: { name: "asc" } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.supplier.findMany({
      where: { locationId: location.id, active: true },
      include: {
        products: {
          where: { active: true },
          include: { ingredient: true },
          orderBy: { ingredient: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    }),
    inventoryService.getStockAlerts(location.id),
  ]);

  const suggestedMap = new Map(
    [...alerts.out, ...alerts.low]
      .filter((a) => a.suggestedPurchase > 0)
      .map((a) => [a.id, a]),
  );

  const suggestedIngredients = await prisma.ingredient.findMany({
    where: { id: { in: [...suggestedMap.keys()] } },
    include: { preferredSupplier: true },
    orderBy: { name: "asc" },
  });

  return (
    <PurchasesAdminView
      locationId={location.id}
      canWrite={canWrite}
      canReceive={canReceive}
      suggested={suggestedIngredients.map((ing) => {
        const alert = suggestedMap.get(ing.id)!;
        return {
          id: ing.id,
          name: ing.name,
          baseUnit: ing.baseUnit,
          averageCost: Number(ing.averageCost).toFixed(4),
          suggestedPurchase: alert.suggestedPurchase,
          preferredSupplierName: ing.preferredSupplier?.name ?? null,
        };
      })}
      suppliers={suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        products: s.products.map((p) => ({
          ingredientId: p.ingredientId,
          ingredientName: p.ingredient.name,
          unit: p.unit,
          unitCost: Number(p.unitCost).toFixed(4),
        })),
      }))}
      orders={orders.map((order) => ({
        id: order.id,
        status: order.status,
        supplierId: order.supplierId,
        supplierName: order.supplier.name,
        notes: order.notes,
        orderedAtLabel: order.orderedAt
          ? format(order.orderedAt, "dd/MM/yyyy HH:mm")
          : null,
        expectedDeliveryLabel: order.expectedDelivery
          ? format(order.expectedDelivery, "dd/MM/yyyy")
          : null,
        receivedAtLabel: order.receivedAt
          ? format(order.receivedAt, "dd/MM/yyyy HH:mm")
          : null,
        createdAtLabel: format(order.createdAt, "dd/MM/yyyy HH:mm"),
        itemCount: order.items.length,
        items: order.items.map((item) => ({
          id: item.id,
          ingredientId: item.ingredientId,
          ingredientName: item.ingredient.name,
          quantityOrdered: Number(item.quantityOrdered).toString(),
          quantityReceived: Number(item.quantityReceived).toString(),
          unit: item.unit,
          expectedUnitCost: Number(item.expectedUnitCost).toFixed(4),
          actualUnitCost:
            item.actualUnitCost != null
              ? Number(item.actualUnitCost).toFixed(4)
              : null,
        })),
      }))}
    />
  );
}
