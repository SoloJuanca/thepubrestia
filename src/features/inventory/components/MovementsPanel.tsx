import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MOVEMENT_TYPE_LABELS,
  UNIT_LABELS,
} from "@/features/inventory/labels";

export type MovementRow = {
  id: string;
  createdAt: string;
  ingredientName: string;
  baseUnit: string;
  quantity: string;
  movementType: string;
  previousStock: string;
  resultingStock: string;
  employeeName: string | null;
  notes: string | null;
};

type Props = {
  movements: MovementRow[];
};

export function MovementsPanel({ movements }: Props) {
  if (movements.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Aún no hay movimientos. Los ajustes, mermas y compras aparecerán aquí.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Ingrediente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Antes → Después</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Notas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {m.createdAt}
              </TableCell>
              <TableCell className="font-medium">{m.ingredientName}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
                </Badge>
              </TableCell>
              <TableCell>
                {Number(m.quantity) > 0 ? "+" : ""}
                {m.quantity} {UNIT_LABELS[m.baseUnit]}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {m.previousStock} → {m.resultingStock}
              </TableCell>
              <TableCell>{m.employeeName ?? "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                {m.notes ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
