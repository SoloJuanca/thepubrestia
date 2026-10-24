import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/rbac";
import { WEB_ORDER_STATUS } from "@/features/store/menu";
import { retryWebOrderSync } from "@/services/wordpress.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis pedidos",
};

export default async function CustomerOrdersPage() {
  const user = await requireCustomer("/cuenta/pedidos");
  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (location) {
    const sync = retryWebOrderSync(location.id);
    void sync;
    try {
      waitUntil(sync);
    } catch {
      // next dev no tiene el contexto de Vercel.
    }
  }

  const orders = await prisma.order.findMany({
    where: {
      source: "WEB",
      checks: { some: { customerId: user.customerProfile!.id } },
    },
    orderBy: { openedAt: "desc" },
    take: 20,
    include: {
      checks: {
        include: {
          items: { include: { modifiers: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Los que armaste aquí. El pago sigue siendo en caja.
          </p>
        </div>
        <Link
          href="/pedir"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Nuevo pedido
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Todavía no tienes pedidos.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const check = order.checks[0];
            return (
              <li key={order.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      Ticket #{order.ticketNumber ?? "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(order.openedAt, "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {WEB_ORDER_STATUS[order.status] ?? order.status}
                  </p>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {(check?.items ?? []).map((item) => (
                    <li key={item.id}>
                      {item.quantity} × {item.nameSnapshot}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm font-semibold">
                  ${Number(check?.total ?? 0).toFixed(2)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
