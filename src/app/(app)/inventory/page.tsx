import { Suspense } from "react";
import { format, subDays } from "date-fns";
import { requirePermission, checkPermission, getCurrentUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { inventoryService } from "@/services/inventory.service";
import { productionService } from "@/services/production.service";
import { InventoryAdminView } from "@/features/inventory/components/InventoryAdminView";

function isBeverageMenuItem(item: {
  category: { name: string };
  tags: string[];
}) {
  const cat = item.category.name.toLowerCase();
  if (cat.includes("bebida")) return true;
  if (item.tags.some((t) => t.toLowerCase().includes("bebida"))) return true;
  return false;
}

type Search = { tab?: string; focus?: string; new?: string };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "alerts" ? "estado" : (sp.tab ?? "home");

  const canViewInventory = await checkPermission("inventory", "read");
  const canViewRecipes = await checkPermission("recipes", "read");
  if (!canViewInventory && !canViewRecipes) {
    await requirePermission("inventory", "read");
  }
  const canAdjust = await checkPermission("inventory", "adjust");
  const canManageIngredients = await checkPermission("inventory", "create");
  const canEditRecipes = await checkPermission("recipes", "update");
  const user = await getCurrentUser();
  const roles = user?.roles.map((r) => r.role.code) ?? [];
  const canViewCosts = !roles.some((r) =>
    ["KITCHEN_COOK", "KITCHEN_ASSISTANT", "KITCHEN"].includes(r),
  );

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

  const needIngredients =
    tab === "home" ||
    tab === "estado" ||
    tab === "ingredients" ||
    tab === "ops" ||
    tab === "production" ||
    tab === "recipes";
  const needSuppliers = tab === "ops" || tab === "ingredients";
  const needMenu = tab === "recipes";
  const needMovements = tab === "movements";
  const needPrep = tab === "production";
  const needWaste = tab === "waste";
  const needYield = tab === "yield";
  const needAlerts = tab === "home" || tab === "estado";
  const needPendingPOs = tab === "home";

  const yieldTo = new Date();
  const yieldFrom = subDays(yieldTo, 30);

  const [
    alerts,
    ingredients,
    suppliers,
    menuItems,
    movements,
    pendingPOs,
    prepRecipes,
    productionBatches,
    wasteRecords,
    yieldRows,
  ] = await Promise.all([
    needAlerts
      ? inventoryService.getStockAlerts(location.id)
      : Promise.resolve({
          low: [],
          out: [],
          suggested: [],
          stalePrepared: [],
          stalePerishable: [],
        }),
    needIngredients
      ? prisma.ingredient.findMany({
          where: { locationId: location.id },
          include: { preferredSupplier: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    needSuppliers
      ? prisma.supplier.findMany({
          where: { locationId: location.id, active: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    needMenu
      ? prisma.menuItem.findMany({
          where: { locationId: location.id, active: true },
          include: {
            category: true,
            recipeItems: {
              include: { ingredient: true },
              orderBy: { ingredient: { name: "asc" } },
            },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    needMovements
      ? prisma.inventoryMovement.findMany({
          where: { locationId: location.id },
          include: { ingredient: true, employee: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    needPendingPOs
      ? prisma.purchaseOrder.count({
          where: {
            locationId: location.id,
            status: { in: ["PENDING", "ORDERED", "PARTIALLY_RECEIVED"] },
          },
        })
      : Promise.resolve(0),
    needPrep
      ? productionService.listPrepRecipes(location.id)
      : Promise.resolve([]),
    needPrep
      ? productionService.listBatches(location.id, 40)
      : Promise.resolve([]),
    needWaste
      ? prisma.wasteRecord.findMany({
          where: { locationId: location.id },
          include: { ingredient: true, employee: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    needYield
      ? productionService.yieldReport({
          locationId: location.id,
          from: yieldFrom,
          to: yieldTo,
        })
      : Promise.resolve([]),
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
        canViewInventory={canViewInventory}
        canManageIngredients={canManageIngredients}
        canEditRecipes={canEditRecipes}
        canViewRecipes={canViewRecipes}
        canViewCosts={canViewCosts}
        alerts={alerts}
        pendingPurchaseOrders={pendingPOs}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        ingredients={ingredients.map((ing) => ({
          id: ing.id,
          name: ing.name,
          category: ing.category,
          kind: ing.kind,
          baseUnit: ing.baseUnit,
          packSize: ing.packSize,
          storageNote: ing.storageNote,
          currentStock: Number(ing.currentStock).toString(),
          minimumStock: Number(ing.minimumStock).toString(),
          targetStock:
            ing.targetStock != null
              ? Number(ing.targetStock).toString()
              : null,
          averageCost: canViewCosts
            ? Number(ing.averageCost).toFixed(4)
            : "0",
          preferredSupplierId: ing.preferredSupplierId,
          preferredSupplierName: ing.preferredSupplier?.name ?? null,
          perishable: ing.perishable,
          stockedAt: ing.stockedAt ? ing.stockedAt.toISOString() : null,
          active: ing.active,
        }))}
        menuItems={menuItems
          .filter((item) => !isBeverageMenuItem(item))
          .map((item) => ({
            id: item.id,
            name: item.name,
            categoryName: item.category.name,
            price: Number(item.price).toFixed(2),
            estimatedCost: Number(item.estimatedCost ?? 0).toFixed(4),
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
        prepRecipes={prepRecipes.map((r) => ({
          id: r.id,
          outputIngredientId: r.outputIngredientId,
          outputName: r.outputIngredient.name,
          outputUnit: r.outputIngredient.baseUnit,
          outputQuantity: Number(r.outputQuantity).toString(),
          notes: r.notes,
          items: r.items.map((i) => ({
            ingredientId: i.ingredientId,
            ingredientName: i.ingredient.name,
            quantity: Number(i.quantity).toString(),
            unit: i.unit,
          })),
        }))}
        productionBatches={productionBatches.map((b) => ({
          id: b.id,
          producedAt: format(b.producedAt, "dd/MM/yyyy HH:mm"),
          outputName: b.outputIngredient.name,
          quantityTheoretical: Number(b.quantityTheoretical).toString(),
          quantityProduced: Number(b.quantityProduced).toString(),
          yieldPercent: Number(b.yieldPercent).toFixed(1),
          employeeName: b.employee?.name ?? b.employee?.email ?? null,
          notes: b.notes,
        }))}
        wasteRows={wasteRecords.map((w) => ({
          id: w.id,
          createdAt: format(w.createdAt, "dd/MM/yyyy HH:mm"),
          ingredientName: w.ingredient.name,
          quantity: Number(w.quantity).toString(),
          unit: w.unit,
          reason: w.reason,
          comment: w.comment,
          employeeName: w.employee?.name ?? w.employee?.email ?? null,
          estimatedCost: (
            Number(w.quantity) * Number(w.ingredient.averageCost)
          ).toFixed(2),
        }))}
        yieldRows={yieldRows}
        yieldFromLabel={format(yieldFrom, "dd/MM/yyyy")}
        yieldToLabel={format(yieldTo, "dd/MM/yyyy")}
      />
    </Suspense>
  );
}
