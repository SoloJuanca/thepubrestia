"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WASTE_REASON_LABELS, UNIT_LABELS } from "@/features/inventory/labels";

export type WasteHistoryRow = {
  id: string;
  createdAt: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  reason: string;
  comment: string | null;
  employeeName: string | null;
  estimatedCost: string;
};

type Props = { rows: WasteHistoryRow[]; canViewCosts?: boolean };

export function WasteHistoryPanel({ rows, canViewCosts = true }: Props) {
  const totalCost = rows.reduce((s, r) => s + Number(r.estimatedCost), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de mermas</CardTitle>
        <CardDescription>
          Últimos registros
          {canViewCosts
            ? ` · costo estimado ≈ $${totalCost.toFixed(2)}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Insumo</th>
              <th className="py-2 pr-3 font-medium">Cantidad</th>
              <th className="py-2 pr-3 font-medium">Motivo</th>
              {canViewCosts ? (
                <th className="py-2 pr-3 font-medium">Costo est.</th>
              ) : null}
              <th className="py-2 font-medium">Quién</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-muted-foreground">
                  Sin mermas registradas.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{r.createdAt}</td>
                  <td className="py-2 pr-3">
                    <div>{r.ingredientName}</div>
                    {r.comment ? (
                      <div className="text-xs text-muted-foreground">
                        {r.comment}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.quantity} {UNIT_LABELS[r.unit] ?? r.unit}
                  </td>
                  <td className="py-2 pr-3">
                    {WASTE_REASON_LABELS[r.reason] ?? r.reason}
                  </td>
                  {canViewCosts ? (
                    <td className="py-2 pr-3">${r.estimatedCost}</td>
                  ) : null}
                  <td className="py-2">{r.employeeName ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
