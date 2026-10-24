import type { Metadata } from "next";
import { OrderMenu } from "@/features/store/components/OrderMenu";
import { loadPublicMenu } from "@/features/store/menu";
import { requireCustomer } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pedir",
};

export default async function PedirPage() {
  const user = await requireCustomer("/pedir");
  const menu = await loadPublicMenu();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Arma tu pedido</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hola{user.name ? `, ${user.name}` : ""}. Elige del menú y recógelo en el
          local. El pago es en caja.
        </p>
      </div>
      {menu.categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          El menú no tiene productos disponibles en este momento.
        </p>
      ) : (
        <OrderMenu categories={menu.categories} />
      )}
    </div>
  );
}
