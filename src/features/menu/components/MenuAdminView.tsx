"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CategoriesPanel, type CategoryRow } from "@/features/menu/components/CategoriesPanel";
import { MenuItemsTable, type MenuItemRow } from "@/features/menu/components/MenuItemsTable";

type Props = {
  locationId: string;
  blobEnabled: boolean;
  categories: CategoryRow[];
  items: MenuItemRow[];
};

export function MenuAdminView({
  locationId,
  blobEnabled,
  categories,
  items,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "categories" ? "categories" : "products";

  function setTab(next: "products" | "categories") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "products") params.delete("tab");
    else params.set("tab", next);
    router.push(`/menu${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menú</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Categorías, productos, imágenes y modificadores.
          </p>
        </div>
        {tab === "products" ? (
          <Link
            href="/menu/items/new"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Nuevo producto
          </Link>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "products"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("products")}
        >
          Productos
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "categories"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("categories")}
        >
          Categorías
        </button>
      </div>

      {tab === "categories" ? (
        <CategoriesPanel
          locationId={locationId}
          blobEnabled={blobEnabled}
          categories={categories}
        />
      ) : (
        <MenuItemsTable items={items} />
      )}
    </div>
  );
}
