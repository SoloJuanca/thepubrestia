"use client";

import { PAYMENT_METHOD_LABELS } from "@/services/printer.service";

export type TicketViewData = {
  restaurantName: string;
  address?: string | null;
  phone?: string | null;
  ticketNumber?: number | null;
  tableName?: string | null;
  waiterName?: string | null;
  checkName: string;
  issuedAtLabel: string;
  widthMm: 58 | 80;
  lines: Array<{
    name: string;
    quantity: number;
    modifiers: string[];
    lineTotal: string;
  }>;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  tipTotal: string;
  total: string;
  payments: Array<{
    method: string;
    amount: string;
    tipAmount: string;
  }>;
};

type Props = { ticket: TicketViewData };

export function TicketView({ ticket }: Props) {
  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .ticket-print-root, .ticket-print-root * { visibility: visible !important; }
          .ticket-print-root {
            position: absolute; left: 0; top: 0;
            width: ${ticket.widthMm}mm; margin: 0; padding: 2mm;
          }
          .no-print { display: none !important; }
          @page { size: ${ticket.widthMm}mm auto; margin: 0; }
        }
        .ticket-print-root {
          width: ${ticket.widthMm}mm;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          line-height: 1.35;
        }
      `}</style>

      <div className="ticket-print-root mx-auto bg-white p-2 text-black">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-wide">
            {ticket.restaurantName}
          </p>
          {ticket.address ? <p>{ticket.address}</p> : null}
          {ticket.phone ? <p>{ticket.phone}</p> : null}
        </div>

        <div className="my-2 border-t border-dashed border-black/40" />

        <p>Ticket: #{ticket.ticketNumber ?? "—"}</p>
        <p>Cuenta: {ticket.checkName}</p>
        <p>Mesa: {ticket.tableName ?? "—"}</p>
        <p>Mesero: {ticket.waiterName ?? "—"}</p>
        <p>Fecha: {ticket.issuedAtLabel}</p>

        <div className="my-2 border-t border-dashed border-black/40" />

        {ticket.lines.map((line, idx) => (
          <div key={idx} className="mb-1">
            <div className="flex justify-between gap-2">
              <span>
                {line.quantity}× {line.name}
              </span>
              <span>${line.lineTotal}</span>
            </div>
            {line.modifiers.map((mod) => (
              <p key={mod} className="pl-2 text-[10px]">
                + {mod}
              </p>
            ))}
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-black/40" />

        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${ticket.subtotal}</span>
        </div>
        <div className="flex justify-between">
          <span>Descuentos</span>
          <span>-${ticket.discountTotal}</span>
        </div>
        <div className="flex justify-between">
          <span>Impuestos</span>
          <span>${ticket.taxTotal}</span>
        </div>
        <div className="flex justify-between">
          <span>Propina</span>
          <span>${ticket.tipTotal}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>${ticket.total}</span>
        </div>

        <div className="my-2 border-t border-dashed border-black/40" />

        {ticket.payments.map((p, idx) => (
          <div key={idx} className="flex justify-between">
            <span>
              {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
              {Number(p.tipAmount) > 0 ? ` (+tip $${p.tipAmount})` : ""}
            </span>
            <span>${p.amount}</span>
          </div>
        ))}

        <p className="mt-3 text-center">¡Gracias por visitarnos!</p>
      </div>
    </>
  );
}
