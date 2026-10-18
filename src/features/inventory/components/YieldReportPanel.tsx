"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UNIT_LABELS } from "@/features/inventory/labels";

export type YieldReportRow = {
  menuItemId: string;
  name: string;
  soldQty: number;
  lines: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    theoretical: number;
    actual: number;
    variancePct: number;
  }>;
};

type Props = { rows: YieldReportRow[]; fromLabel: string; toLabel: string };

export function YieldReportPanel({ rows, fromLabel, toLabel }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rendimiento por órdenes</CardTitle>
        <CardDescription>
          Consumo teórico (receta × ventas) vs real (movimientos de venta) ·{" "}
          {fromLabel} — {toLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay ventas cerradas en el periodo.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.menuItemId}
              className="rounded-xl border border-border/70 p-3"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-muted-foreground">
                  Vendidos: {row.soldQty}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-1 font-medium">Insumo</th>
                    <th className="pb-1 font-medium">Teórico</th>
                    <th className="pb-1 font-medium">Real</th>
                    <th className="pb-1 font-medium">Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line) => (
                    <tr key={line.ingredientId} className="border-t border-border/50">
                      <td className="py-1.5">{line.ingredientName}</td>
                      <td className="py-1.5">
                        {line.theoretical}{" "}
                        {UNIT_LABELS[line.unit] ?? line.unit}
                      </td>
                      <td className="py-1.5">
                        {line.actual} {UNIT_LABELS[line.unit] ?? line.unit}
                      </td>
                      <td
                        className={`py-1.5 font-medium ${
                          Math.abs(line.variancePct) > 15
                            ? "text-amber-700"
                            : ""
                        }`}
                      >
                        {line.variancePct > 0 ? "+" : ""}
                        {line.variancePct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
