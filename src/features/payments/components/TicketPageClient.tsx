"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { TicketView, type TicketViewData } from "@/features/payments/components/TicketView";
import { printerService } from "@/services/printer.service";
import { mintReviewTokenAction } from "@/features/reviews/actions";
import { toast } from "sonner";

type Props = {
  ticket: TicketViewData;
  checkId: string;
  orderId?: string | null;
  tableId?: string | null;
  canMintReview?: boolean;
};

export function TicketPageClient({
  ticket,
  checkId,
  orderId,
  tableId,
  canMintReview,
}: Props) {
  const [widthMm, setWidthMm] = useState<58 | 80>(ticket.widthMm);
  const [pending, startTransition] = useTransition();
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);


  async function onPrint() {
    const result = await printerService.printTicket({
      restaurantName: ticket.restaurantName,
      address: ticket.address,
      phone: ticket.phone,
      ticketNumber: ticket.ticketNumber,
      tableName: ticket.tableName,
      waiterName: ticket.waiterName,
      checkName: ticket.checkName,
      issuedAt: new Date(),
      lines: ticket.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPrice: 0,
        modifiers: l.modifiers,
        lineTotal: Number(l.lineTotal),
      })),
      subtotal: Number(ticket.subtotal),
      discountTotal: Number(ticket.discountTotal),
      taxTotal: Number(ticket.taxTotal),
      tipTotal: Number(ticket.tipTotal),
      total: Number(ticket.total),
      payments: ticket.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        tipAmount: Number(p.tipAmount),
      })),
    });
    toast.message(result.message);
    window.print();
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Ticket</h1>
          <p className="text-sm text-muted-foreground">
            Cuenta {checkId.slice(0, 8)}… · {format(new Date(), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={widthMm}
            onChange={(e) => setWidthMm(Number(e.target.value) as 58 | 80)}
          >
            <option value={58}>58 mm</option>
            <option value={80}>80 mm</option>
          </select>
          <Button onClick={onPrint}>Imprimir</Button>
          {canMintReview ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await mintReviewTokenAction({
                    orderId: orderId ?? null,
                    expiresInDays: 14,
                  });
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success(result.message);
                    setReviewUrl(`${window.location.origin}${result.url}`);
                  }
                })
              }
            >
              QR reseña
            </Button>
          ) : null}
          {tableId ? (
            <Link
              href={`/pos/tables/${tableId}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Volver a mesa
            </Link>
          ) : (
            <Link href="/pos" className={cn(buttonVariants({ variant: "outline" }))}>
              POS
            </Link>
          )}
        </div>
      </div>

      {reviewUrl ? (
        <p className="no-print break-all text-sm text-muted-foreground">
          Reseña: {reviewUrl}
        </p>
      ) : null}

      <TicketView ticket={{ ...ticket, widthMm }} />
    </div>
  );
}
