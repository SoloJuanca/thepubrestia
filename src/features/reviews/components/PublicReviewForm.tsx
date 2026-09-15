"use client";

import { useState, useTransition } from "react";
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
import { submitPublicReviewAction } from "@/features/reviews/actions";

type Props = {
  token: string;
  restaurantName: string;
  tableName?: string | null;
};

export function PublicReviewForm({ token, restaurantName, tableName }: Props) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    overallRating: "5",
    foodRating: "5",
    serviceRating: "5",
    ambienceRating: "5",
    comment: "",
    guestName: "",
    guestEmail: "",
  });

  if (done) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>¡Gracias!</CardTitle>
          <CardDescription>
            Tu reseña para {restaurantName} fue registrada.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Reseña — {restaurantName}</CardTitle>
        <CardDescription>
          {tableName ? `Mesa ${tableName} · ` : ""}
          Califica tu experiencia (1–5).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(
          [
            ["overallRating", "Calificación general"],
            ["foodRating", "Comida"],
            ["serviceRating", "Servicio"],
            ["ambienceRating", "Ambiente"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label>{label}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={form[key]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.value }))
              }
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="space-y-1">
          <Label>Comentario</Label>
          <Textarea
            rows={3}
            value={form.comment}
            onChange={(e) =>
              setForm((f) => ({ ...f, comment: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Nombre (opcional)</Label>
          <Input
            value={form.guestName}
            onChange={(e) =>
              setForm((f) => ({ ...f, guestName: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Email (opcional)</Label>
          <Input
            type="email"
            value={form.guestEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, guestEmail: e.target.value }))
            }
          />
        </div>
        <Button
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await submitPublicReviewAction({
                token,
                overallRating: Number(form.overallRating),
                foodRating: Number(form.foodRating),
                serviceRating: Number(form.serviceRating),
                ambienceRating: Number(form.ambienceRating),
                comment: form.comment || null,
                guestName: form.guestName || null,
                guestEmail: form.guestEmail || null,
              });
              if (!result.ok) toast.error(result.error);
              else {
                toast.success(result.message);
                setDone(true);
              }
            })
          }
        >
          Enviar reseña
        </Button>
      </CardContent>
    </Card>
  );
}
