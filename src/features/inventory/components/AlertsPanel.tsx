import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AlertIngredient } from "@/services/inventory.service";
import { UNIT_LABELS } from "@/features/inventory/labels";

type Props = {
  low: AlertIngredient[];
  out: AlertIngredient[];
  suggested: AlertIngredient[];
  pendingPurchaseOrders: number;
};

export function AlertsPanel({
  low,
  out,
  suggested,
  pendingPurchaseOrders,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Por agotarse"
          value={String(low.length)}
          tone={low.length > 0 ? "warn" : "ok"}
        />
        <SummaryCard
          title="Agotados"
          value={String(out.length)}
          tone={out.length > 0 ? "danger" : "ok"}
        />
        <SummaryCard
          title="Pedido sugerido"
          value={String(suggested.length)}
          tone={suggested.length > 0 ? "warn" : "ok"}
        />
        <SummaryCard
          title="Pedidos pendientes"
          value={String(pendingPurchaseOrders)}
          hint="Pedidos a proveedor pendientes"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AlertList
          title="Stock bajo"
          empty="Ningún ingrediente bajo el mínimo."
          rows={low}
        />
        <AlertList
          title="Agotados"
          empty="No hay insumos en cero."
          rows={out}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedido sugerido</CardTitle>
          <CardDescription>
            Regla: comprar hasta stock objetivo (o mínimo si no hay objetivo).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {suggested.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay compras sugeridas.
            </p>
          ) : (
            suggested.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
              >
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Stock {row.currentStock} {UNIT_LABELS[row.baseUnit]} · min{" "}
                    {row.minimumStock}
                    {row.targetStock != null
                      ? ` · objetivo ${row.targetStock}`
                      : ""}
                    {row.preferredSupplierName
                      ? ` · ${row.preferredSupplierName}`
                      : ""}
                  </p>
                </div>
                <Badge variant="secondary">
                  Comprar {row.suggestedPurchase}{" "}
                  {UNIT_LABELS[row.baseUnit]}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle
          className={
            tone === "danger"
              ? "text-2xl text-destructive"
              : tone === "warn"
                ? "text-2xl text-amber-700"
                : "text-2xl"
          }
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

function AlertList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: AlertIngredient[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
            >
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.currentStock} / min {row.minimumStock}{" "}
                  {UNIT_LABELS[row.baseUnit]}
                </p>
              </div>
              <Badge variant={row.status === "OUT" ? "destructive" : "secondary"}>
                {row.status === "OUT" ? "Agotado" : "Bajo"}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
