"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { confirmDailyCloseAction } from "@/features/payments/actions";

export type DailyClosePreview = {
  businessDate: string;
  salesTotal: string;
  cashExpected: string;
  cardTotal: string;
  transferTotal: string;
  tipsTotal: string;
  discountsTotal: string;
  cancellationsTotal: string;
  wasteTotal: string;
  orderCount: number;
  paymentCount: number;
  checkCount: number;
  alreadyClosed: boolean;
  closedAtLabel?: string | null;
};

type Props = {
  preview: DailyClosePreview;
  canConfirm: boolean;
};

export function DailyClosePanel({ preview, canConfirm }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(preview.businessDate);
  const [notes, setNotes] = useState("");

  function onDateChange(value: string) {
    setDate(value);
    router.push(`/daily-close?date=${value}`);
  }

  function onConfirm() {
    startTransition(async () => {
      const result = await confirmDailyCloseAction({
        businessDate: date,
        notes: notes || null,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cierre de día</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de ventas, métodos de pago, propinas y mermas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fecha de negocio</CardTitle>
          <CardDescription>
            Confirmar genera un registro de auditoría inmutable para el día.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz-date">Fecha</Label>
            <Input
              id="biz-date"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Al cambiar la fecha se actualiza el resumen del día seleccionado.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Ventas" value={`$${preview.salesTotal}`} />
        <Metric label="Efectivo" value={`$${preview.cashExpected}`} />
        <Metric label="Tarjeta" value={`$${preview.cardTotal}`} />
        <Metric label="Transferencia" value={`$${preview.transferTotal}`} />
        <Metric label="Propinas" value={`$${preview.tipsTotal}`} />
        <Metric label="Descuentos" value={`$${preview.discountsTotal}`} />
        <Metric label="Cancelaciones" value={`$${preview.cancellationsTotal}`} />
        <Metric label="Merma ($)" value={`$${preview.wasteTotal}`} />
        <Metric label="Órdenes cerradas" value={String(preview.orderCount)} />
        <Metric label="Cuentas cobradas" value={String(preview.checkCount)} />
        <Metric label="Pagos" value={String(preview.paymentCount)} />
      </div>

      {preview.alreadyClosed ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Este día ya fue cerrado
            {preview.closedAtLabel ? ` (${preview.closedAtLabel})` : ""}.
          </CardContent>
        </Card>
      ) : canConfirm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirmar cierre</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              className="min-h-11"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? "Guardando…" : "Confirmar cierre de día"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
