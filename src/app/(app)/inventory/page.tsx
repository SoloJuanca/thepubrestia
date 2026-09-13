import { Suspense } from "react";
import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { inventoryService } from "@/services/inventory.service";
import { InventoryAdminView } from "@/features/inventory/components/InventoryAdminView";

export default async function InventoryPage() {
  await requirePermission("inventory", "read");
  const canAdjust = await checkPermission("inventory", "adjust");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          No hay sucursal activa. Ejecuta el seed.
        </p>
      </div>
    );
  }

  const [alerts, ingredients, suppliers, menuItems, movements, pendingPOs] =
    await Promise.all([
      inventoryService.getStockAlerts(location.id),
      prisma.ingredient.findMany({
        where: { locationId: location.id },
        include: { preferredSupplier: true },
        orderBy: { name: "asc" },
      }),
      prisma.supplier.findMany({
        where: { locationId: location.id, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.menuItem.findMany({
        where: { locationId: location.id, active: true },
        include: {
          category: true,
          recipeItems: {
            include: { ingredient: true },
            orderBy: { ingredient: { name: "asc" } },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.inventoryMovement.findMany({
        where: { locationId: location.id },
        include: {
          ingredient: true,
          employee: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.purchaseOrder.count({
        where: {
          locationId: location.id,
          status: { in: ["PENDING", "ORDERED", "PARTIALLY_RECEIVED"] },
        },
      }),
    ]);

  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Cargando inventario…</p>
      }
    >
      <InventoryAdminView
        locationId={location.id}
        canAdjust={canAdjust}
        alerts={alerts}
        pendingPurchaseOrders={pendingPOs}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        ingredients={ingredients.map((ing) => ({
          id: ing.id,
          name: ing.name,
          category: ing.category,
          baseUnit: ing.baseUnit,
          currentStock: Number(ing.currentStock).toString(),
          minimumStock: Number(ing.minimumStock).toString(),
          targetStock:
            ing.targetStock != null ? Number(ing.targetStock).toString() : null,
          averageCost: Number(ing.averageCost).toFixed(4),
          preferredSupplierId: ing.preferredSupplierId,
          preferredSupplierName: ing.preferredSupplier?.name ?? null,
          active: ing.active,
        }))}
        menuItems={menuItems.map((item) => ({
          id: item.id,
          name: item.name,
          categoryName: item.category.name,
          items: item.recipeItems.map((r) => ({
            ingredientId: r.ingredientId,
            ingredientName: r.ingredient.name,
            quantity: Number(r.quantity).toString(),
            unit: r.unit,
          })),
        }))}
        movements={movements.map((m) => ({
          id: m.id,
          createdAt: format(m.createdAt, "dd/MM/yyyy HH:mm"),
          ingredientName: m.ingredient.name,
          baseUnit: m.ingredient.baseUnit,
          quantity: Number(m.quantity).toString(),
          movementType: m.movementType,
          previousStock: Number(m.previousStock).toString(),
          resultingStock: Number(m.resultingStock).toString(),
          employeeName: m.employee?.name ?? m.employee?.email ?? null,
          notes: m.notes,
        }))}
      />
    </Suspense>
  );
}
