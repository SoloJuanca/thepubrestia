"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mintReviewTokenAction } from "@/features/reviews/actions";

export type ReviewRow = {
  id: string;
  overallRating: number;
  foodRating: number | null;
  serviceRating: number | null;
  ambienceRating: number | null;
  comment: string | null;
  guestName: string | null;
  waiterName: string | null;
  tableName: string | null;
  createdAtLabel: string;
};

type Props = {
  canCreate: boolean;
  averages: {
    overall: string;
    food: string;
    service: string;
    ambience: string;
    count: number;
  };
  reviews: ReviewRow[];
  recentOrderIds: Array<{ id: string; label: string }>;
};

export function ReviewsDashboard({
  canCreate,
  averages,
  reviews,
  recentOrderIds,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [orderId, setOrderId] = useState(recentOrderIds[0]?.id ?? "");
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reseñas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tokens QR opacos, formulario público y promedios operativos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Calificación general" value={averages.overall} />
        <Metric label="Comida" value={averages.food} />
        <Metric label="Servicio" value={averages.service} />
        <Metric label="Ambiente" value={averages.ambience} />
        <Metric label="Total" value={String(averages.count)} />
      </div>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generar enlace de reseña</CardTitle>
            <CardDescription>
              El token no expone el ID de la orden en la URL pública.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <select
              className="flex h-10 min-w-56 rounded-md border border-input bg-transparent px-2 text-sm"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">Sin orden asociada</option>
              {recentOrderIds.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await mintReviewTokenAction({
                    orderId: orderId || null,
                    expiresInDays: 14,
                  });
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success(result.message);
                    const origin =
                      typeof window !== "undefined" ? window.location.origin : "";
                    setLastUrl(`${origin}${result.url}`);
                  }
                })
              }
            >
              Generar token
            </Button>
            {lastUrl ? (
              <p className="w-full break-all text-sm text-muted-foreground">
                {lastUrl}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay reseñas.</p>
        ) : (
          reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge>{r.overallRating}/5</Badge>
                    <span className="text-sm font-medium">
                      {r.guestName ?? "Anónimo"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{r.comment ?? "Sin comentario"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.createdAtLabel}
                    {r.waiterName ? ` · mesero ${r.waiterName}` : ""}
                    {r.tableName ? ` · mesa ${r.tableName}` : ""}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  C {r.foodRating ?? "—"} · S {r.serviceRating ?? "—"} · A{" "}
                  {r.ambienceRating ?? "—"}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
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
