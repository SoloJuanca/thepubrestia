import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { isBlobConfigured } from "@/services/storage.service";
import { MenuItemForm } from "@/features/menu/components/MenuItemForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditMenuItemPage({ params }: Props) {
  await requirePermission("menu", "update");
  const { id } = await params;

  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: {
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          options: { orderBy: { sortOrder: "asc" } },
        },
      },
      recipeItems: {
        include: { ingredient: true },
      },
    },
  });

  if (!item) notFound();

  const categories = await prisma.menuCategory.findMany({
    where: { locationId: item.locationId, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/menu"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver al menú
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {item.name}
        </h1>
        {item.recipeItems.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Receta (Fase 3 editará insumos):{" "}
            {item.recipeItems
              .map(
                (r) =>
                  `${Number(r.quantity)} ${r.unit.toLowerCase()} ${r.ingredient.name}`,
              )
              .join(" · ")}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Sin receta vinculada todavía (se gestiona en Inventario / Fase 3).
          </p>
        )}
      </div>

      <MenuItemForm
        mode="edit"
        locationId={item.locationId}
        blobEnabled={isBlobConfigured()}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          sku: item.sku,
          price: Number(item.price).toFixed(2),
          estimatedCost:
            item.estimatedCost != null
              ? Number(item.estimatedCost).toFixed(2)
              : null,
          taxRate: Number(item.taxRate).toString(),
          imageUrl: item.imageUrl,
          imagePath: item.imagePath,
          available: item.available,
          requiresPrep: item.requiresPrep,
          estimatedPrepMins: item.estimatedPrepMins,
          tags: item.tags,
          active: item.active,
          modifierGroups: item.modifierGroups.map((g) => ({
            name: g.name,
            required: g.required,
            minSelections: g.minSelections,
            maxSelections: g.maxSelections,
            sortOrder: g.sortOrder,
            options: g.options.map((o) => ({
              name: o.name,
              priceDelta: Number(o.priceDelta),
              active: o.active,
              sortOrder: o.sortOrder,
            })),
          })),
        }}
      />
    </div>
  );
}
