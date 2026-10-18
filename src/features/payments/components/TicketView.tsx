"use client";

import { PAYMENT_METHOD_LABELS } from "@/services/printer.service";

export type TicketViewData = {
  restaurantName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  ticketNumber?: number | null;
  tableName?: string | null;
  waiterName?: string | null;
  checkName: string;
  issuedAtLabel: string;
  /** Paper profile: 58mm roll or ~80mm roll (labeled 84). */
  widthMm: 58 | 84;
  lines: Array<{
    name: string;
    quantity: number;
    modifiers: string[];
    lineTotal: string;
  }>;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  /** Account total only — tips are never printed on the fiscal/customer ticket. */
  total: string;
  payments: Array<{
    method: string;
    amount: string;
  }>;
};

type Props = { ticket: TicketViewData };

function MoneyRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={bold ? "ticket-row-bold" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 8ch",
        columnGap: "6px",
        width: "100%",
        alignItems: "start",
      }}
    >
      <span style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
        {label}
      </span>
      <span
        className="ticket-money"
        style={{
          textAlign: "right",
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function addressLines(address: string): string[] {
  return address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function TicketView({ ticket }: Props) {
  const paperMm = ticket.widthMm === 58 ? 58 : 80;
  const lines = ticket.address ? addressLines(ticket.address) : [];

  return (
    <>
      <style>{`
        @media print {
          html, body {
            width: ${paperMm}mm !important;
            min-width: ${paperMm}mm !important;
            max-width: ${paperMm}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * { visibility: hidden !important; }
          .ticket-print-root, .ticket-print-root * { visibility: visible !important; }
          /* Must be absolute top-left: otherwise it keeps the on-screen
             centered offset from the wide preview layout. */
          .ticket-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            right: auto !important;
            transform: none !important;
            width: ${paperMm}mm !important;
            max-width: ${paperMm}mm !important;
            margin: 0 !important;
            padding: 1.5mm 5.5mm 1.5mm 2mm !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }
          .ticket-money {
            min-width: 8ch !important;
            padding-right: 2px !important;
          }
          .no-print { display: none !important; }
          @page {
            size: ${paperMm}mm auto;
            margin: 0;
          }
        }
        .ticket-print-root {
          width: ${paperMm}mm;
          max-width: 100%;
          margin: 0 auto;
          padding: 0 2px 0 0;
          box-sizing: border-box;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          line-height: 1.35;
          color: #000;
        }
        .ticket-print-root * {
          box-sizing: border-box;
        }
        .ticket-money {
          min-width: 8ch;
          padding-right: 2px;
        }
        .ticket-row-bold {
          font-size: 12px;
          font-weight: 700;
          margin-top: 2px;
        }
      `}</style>

      <div className="ticket-print-root bg-white text-black">
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {ticket.restaurantName}
          </p>
          {lines.map((line) => (
            <p key={line} style={{ margin: "1px 0 0" }}>
              {line}
            </p>
          ))}
          {ticket.phone ? (
            <p style={{ margin: "2px 0 0" }}>{ticket.phone}</p>
          ) : null}
          {ticket.email ? (
            <p style={{ margin: "2px 0 0", overflowWrap: "anywhere" }}>
              {ticket.email}
            </p>
          ) : null}
          {ticket.website ? (
            <p style={{ margin: "2px 0 0", overflowWrap: "anywhere" }}>
              {ticket.website}
            </p>
          ) : null}
        </div>

        <div
          style={{
            margin: "6px 0",
            borderTop: "1px dashed rgba(0,0,0,0.45)",
          }}
        />

        <p style={{ margin: 0 }}>Ticket: #{ticket.ticketNumber ?? "—"}</p>
        <p style={{ margin: 0 }}>Cuenta: {ticket.checkName}</p>
        <p style={{ margin: 0 }}>Mesa: {ticket.tableName ?? "—"}</p>
        <p style={{ margin: 0 }}>Mesero: {ticket.waiterName ?? "—"}</p>
        <p style={{ margin: 0 }}>Fecha: {ticket.issuedAtLabel}</p>

        <div
          style={{
            margin: "6px 0",
            borderTop: "1px dashed rgba(0,0,0,0.45)",
          }}
        />

        {ticket.lines.map((line, idx) => (
          <div key={idx} style={{ marginBottom: 4 }}>
            <MoneyRow
              label={`${line.quantity}× ${line.name}`}
              value={`$${line.lineTotal}`}
            />
            {line.modifiers.map((mod) => (
              <p key={mod} style={{ margin: "0 0 0 6px", fontSize: "10px" }}>
                + {mod}
              </p>
            ))}
          </div>
        ))}

        <div
          style={{
            margin: "6px 0",
            borderTop: "1px dashed rgba(0,0,0,0.45)",
          }}
        />

        <MoneyRow label="Subtotal" value={`$${ticket.subtotal}`} />
        <MoneyRow label="Descuentos" value={`-$${ticket.discountTotal}`} />
        <MoneyRow label="Impuestos" value={`$${ticket.taxTotal}`} />
        <MoneyRow label="TOTAL" value={`$${ticket.total}`} bold />

        <div
          style={{
            margin: "6px 0",
            borderTop: "1px dashed rgba(0,0,0,0.45)",
          }}
        />

        {ticket.payments.map((p, idx) => (
          <MoneyRow
            key={idx}
            label={PAYMENT_METHOD_LABELS[p.method] ?? p.method}
            value={`$${p.amount}`}
          />
        ))}

        <p style={{ margin: "10px 0 0", textAlign: "center" }}>
          ¡Gracias por visitarnos!
        </p>
      </div>
    </>
  );
}
