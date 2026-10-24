import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/rbac";
import { WEB_ORDER_STATUS } from "@/features/store/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pedido enviado",
};

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderReadyPage({ params }: Props) {
  const { orderId } = await params;
  const user = await requireCustomer(`/pedir/listo/${orderId}`);
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      source: "WEB",
      checks: { some: { customerId: user.customerProfile!.id } },
    },
    include: {
      checks: {
        include: {
          items: { include: { modifiers: true } },
        },
      },
    },
  });

  if (!order) notFound();

  const check = order.checks[0];
  const items = check?.items ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-sm font-medium text-[var(--pub-blue)]">Pedido recibido</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {order.guestName}, ya está en cocina
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ticket #{order.ticketNumber ?? "—"}. Paga en caja cuando pases a recogerlo.
          No se hizo ningún cobro en línea.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">
                {item.quantity} × {item.nameSnapshot}
              </p>
              {item.modifiers.length ? (
                <p className="text-muted-foreground">
                  {item.modifiers.map((modifier) => modifier.nameSnapshot).join(", ")}
                </p>
              ) : null}
            </div>
            <p>${Number(item.lineTotal).toFixed(2)}</p>
          </li>
        ))}
      </ul>
      <p className="text-right text-base font-semibold">
        Total ${Number(check?.total ?? 0).toFixed(2)}
      </p>
      <p className="text-sm text-muted-foreground">
        Estado: {WEB_ORDER_STATUS[order.status] ?? order.status}
      </p>
      <div className="flex gap-3">
        <Link
          href="/pedir"
          className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Pedir algo más
        </Link>
        <Link
          href="/cuenta/pedidos"
          className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium"
        >
          Mis pedidos
        </Link>
      </div>
    </div>
  );
}
