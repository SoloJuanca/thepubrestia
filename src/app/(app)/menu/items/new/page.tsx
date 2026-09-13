import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { isBlobConfigured } from "@/services/storage.service";
import { MenuItemForm } from "@/features/menu/components/MenuItemForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function NewMenuItemPage() {
  await requirePermission("menu", "create");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) notFound();

  const categories = await prisma.menuCategory.findMany({
    where: { locationId: location.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          Primero crea al menos una categoría activa.
        </p>
        <Link
          href="/menu?tab=categories"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Ir a categorías
        </Link>
      </div>
    );
  }

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
          Nuevo producto
        </h1>
      </div>
      <MenuItemForm
        mode="create"
        locationId={location.id}
        blobEnabled={isBlobConfigured()}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
