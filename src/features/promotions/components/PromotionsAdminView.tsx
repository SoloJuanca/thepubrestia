"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createPromotionAction,
  updatePromotionAction,
} from "@/features/promotions/actions";

export type PromotionRow = {
  id: string;
  name: string;
  code: string;
  type: string;
  amount: string;
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  appliesToEntireCheck: boolean;
  perCustomerLimit: number | null;
  totalLimit: number | null;
};

type Props = {
  locationId: string;
  canWrite: boolean;
  promotions: PromotionRow[];
};

const empty = {
  name: "",
  code: "",
  description: "",
  type: "PERCENTAGE" as const,
  amount: "10",
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: "",
  appliesToEntireCheck: true,
  active: true,
};

export function PromotionsAdminView({
  locationId,
  canWrite,
  promotions,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(empty);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Promociones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Códigos, vigencia, límites y alcance (cuenta completa).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nueva promoción</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Código</Label>
                  <Input
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        type: e.target.value as typeof form.type,
                      }))
                    }
                  >
                    <option value="PERCENTAGE">Porcentaje</option>
                    <option value="FIXED_AMOUNT">Monto fijo</option>
                    <option value="FREE_PRODUCT">Producto gratis</option>
                    <option value="SPECIAL_PRICE">Precio especial</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Monto / %</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Inicio</Label>
                  <Input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startsAt: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fin (opcional)</Label>
                  <Input
                    type="date"
                    value={form.endsAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endsAt: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.appliesToEntireCheck}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      appliesToEntireCheck: e.target.checked,
                    }))
                  }
                />
                Aplica a toda la cuenta
              </label>
              <Button
                disabled={pending || !form.name || !form.code}
                onClick={() =>
                  startTransition(async () => {
                    const result = await createPromotionAction({
                      locationId,
                      name: form.name,
                      code: form.code,
                      description: form.description || null,
                      type: form.type,
                      amount: Number(form.amount) || 0,
                      startsAt: form.startsAt,
                      endsAt: form.endsAt || null,
                      active: true,
                      appliesToEntireCheck: form.appliesToEntireCheck,
                      menuItemIds: [],
                      categoryIds: [],
                    });
                    if (!result.ok) toast.error(result.error);
                    else {
                      toast.success(result.message);
                      setForm(empty);
                    }
                  })
                }
              >
                Crear
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activas / históricas</CardTitle>
            <CardDescription>{promotions.length} promociones</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.code}</TableCell>
                    <TableCell>
                      <div>{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.type} · {p.amount}
                        {p.appliesToEntireCheck ? " · cuenta" : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>
                        {p.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await updatePromotionAction({
                                id: p.id,
                                active: !p.active,
                              });
                              if (!result.ok) toast.error(result.error);
                              else toast.success(result.message);
                            })
                          }
                        >
                          {p.active ? "Desactivar" : "Activar"}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
