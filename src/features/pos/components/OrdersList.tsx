import Link from "next/link";
import { format, differenceInMinutes } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type OrderListRow = {
  id: string;
  ticketNumber: number | null;
  tableName: string | null;
  tableId: string | null;
  status: string;
  waiterName: string | null;
  openedAt: Date;
  total: string;
  checkCount: number;
};

type Props = { orders: OrderListRow[] };

export function OrdersList({ orders }: Props) {
  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No hay órdenes abiertas.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket</TableHead>
            <TableHead>Mesa</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Mesero</TableHead>
            <TableHead>Tiempo</TableHead>
            <TableHead>Total</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>#{order.ticketNumber ?? "—"}</TableCell>
              <TableCell>{order.tableName ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{order.status}</Badge>
              </TableCell>
              <TableCell>{order.waiterName ?? "—"}</TableCell>
              <TableCell>
                {differenceInMinutes(new Date(), order.openedAt)} min
                <span className="block text-xs text-muted-foreground">
                  {format(order.openedAt, "HH:mm")}
                </span>
              </TableCell>
              <TableCell>
                ${order.total}
                <span className="block text-xs text-muted-foreground">
                  {order.checkCount} cuenta(s)
                </span>
              </TableCell>
              <TableCell className="text-right">
                {order.tableId ? (
                  <Link
                    href={`/pos/tables/${order.tableId}`}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    Abrir
                  </Link>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
