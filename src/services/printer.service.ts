/**
 * Printer abstraction — browser print now; ESC/POS / QZ Tray later.
 * Do not pretend the browser has raw hardware access.
 */
export type TicketLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: string[];
  lineTotal: number;
};

export type TicketPayload = {
  restaurantName: string;
  address?: string | null;
  phone?: string | null;
  ticketNumber?: number | null;
  tableName?: string | null;
  waiterName?: string | null;
  checkName: string;
  issuedAt: Date;
  lines: TicketLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  tipTotal: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
    tipAmount: number;
  }>;
};

export type PrintResult = {
  mode: "BROWSER_PRINT" | "NOOP";
  message: string;
};

export interface PrinterService {
  printTicket(payload: TicketPayload): Promise<PrintResult>;
}

export class BrowserPrinterService implements PrinterService {
  async printTicket(): Promise<PrintResult> {
    return {
      mode: "BROWSER_PRINT",
      message:
        "Usa la vista de ticket y window.print() con CSS 58mm/80mm. Integración ESC/POS pendiente.",
    };
  }
}

export class NoopPrinterService implements PrinterService {
  async printTicket(): Promise<PrintResult> {
    return {
      mode: "NOOP",
      message: "PrinterService no configurado.",
    };
  }
}

export const printerService: PrinterService = new BrowserPrinterService();

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};
