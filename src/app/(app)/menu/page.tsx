import { Suspense } from "react";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { isBlobConfigured } from "@/services/storage.service";
import { MenuAdminView } from "@/features/menu/components/MenuAdminView";

export default async function MenuPage() {
  await requirePermission("menu", "read");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Menú</h1>
        <p className="text-sm text-muted-foreground">
          No hay sucursal activa. Ejecuta el seed de Fase 1.
        </p>
      </div>
    );
  }

  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { locationId: location.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { items: true } } },
    }),
    prisma.menuItem.findMany({
      where: { locationId: location.id },
      orderBy: [{ name: "asc" }],
      include: {
        category: true,
        _count: {
          select: { modifierGroups: true, recipeItems: true },
        },
      },
    }),
  ]);

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando menú…</p>}>
      <MenuAdminView
        locationId={location.id}
        blobEnabled={isBlobConfigured()}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl,
          imagePath: c.imagePath,
          sortOrder: c.sortOrder,
          active: c.active,
          itemCount: c._count.items,
        }))}
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          categoryName: item.category.name,
          sku: item.sku,
          price: Number(item.price).toFixed(2),
          available: item.available,
          active: item.active,
          imageUrl: item.imageUrl,
          modifierGroupCount: item._count.modifierGroups,
          recipeCount: item._count.recipeItems,
        }))}
      />
    </Suspense>
  );
}
