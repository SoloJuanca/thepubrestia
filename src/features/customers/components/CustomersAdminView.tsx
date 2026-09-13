"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  assignCustomerPromoAction,
  updateCustomerAction,
  upsertCustomerAction,
} from "@/features/customers/actions";

export type CustomerRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  visits: number;
  lifetimeSpend: string;
  lastVisitLabel: string | null;
  wallet: Array<{
    id: string;
    promoName: string;
    promoCode: string;
    used: boolean;
    expiresLabel: string | null;
  }>;
};

type PromoOption = { id: string; name: string; code: string };

type Props = {
  canWrite: boolean;
  canAssignPromo: boolean;
  customers: CustomerRow[];
  promotions: PromoOption[];
};

export function CustomersAdminView({
  canWrite,
  canAssignPromo,
  customers,
  promotions,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(customers[0]?.id ?? "");
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
  });
  const [promoId, setPromoId] = useState(promotions[0]?.id ?? "");

  const selected = useMemo(
    () => customers.find((c) => c.id === selectedId) ?? null,
    [customers, selectedId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Perfil, visitas, gasto acumulado y wallet de promociones.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo / upsert por email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={form.email}
                disabled={!canWrite || pending}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                disabled={!canWrite || pending}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                disabled={!canWrite || pending}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            {canWrite ? (
              <Button
                disabled={pending || !form.email}
                onClick={() =>
                  startTransition(async () => {
                    const result = await upsertCustomerAction({
                      email: form.email,
                      name: form.name || null,
                      phone: form.phone || null,
                    });
                    if (!result.ok) toast.error(result.error);
                    else {
                      toast.success(result.message);
                      if (result.id) setSelectedId(result.id);
                      setForm({ email: "", name: "", phone: "" });
                    }
                  })
                }
              >
                Guardar cliente
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listado</CardTitle>
            <CardDescription>{customers.length} clientes</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Visitas</TableHead>
                  <TableHead>Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    className={selectedId === c.id ? "bg-muted/40" : undefined}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => setSelectedId(c.id)}
                      >
                        <div className="font-medium">{c.name ?? "Sin nombre"}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.email}
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>{c.visits}</TableCell>
                    <TableCell>${c.lifetimeSpend}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalle — {selected.name ?? selected.email}
            </CardTitle>
            <CardDescription>
              Última visita: {selected.lastVisitLabel ?? "—"} · Tel{" "}
              {selected.phone ?? "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="Teléfono"
                  defaultValue={selected.phone ?? ""}
                  id={`phone-${selected.id}`}
                />
                <Button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const el = document.getElementById(
                        `phone-${selected.id}`,
                      ) as HTMLInputElement | null;
                      const result = await updateCustomerAction({
                        id: selected.id,
                        phone: el?.value || null,
                      });
                      if (!result.ok) toast.error(result.error);
                      else toast.success(result.message);
                    })
                  }
                >
                  Actualizar teléfono
                </Button>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-medium">Wallet</h3>
              <ul className="space-y-2 text-sm">
                {selected.wallet.length === 0 ? (
                  <li className="text-muted-foreground">Sin cupones.</li>
                ) : (
                  selected.wallet.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span>
                        {w.promoName} ({w.promoCode})
                        {w.expiresLabel ? ` · exp ${w.expiresLabel}` : ""}
                      </span>
                      <Badge variant={w.used ? "secondary" : "default"}>
                        {w.used ? "Usado" : "Disponible"}
                      </Badge>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {canAssignPromo && promotions.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label>Asignar promoción</Label>
                  <select
                    className="flex h-10 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={promoId}
                    onChange={(e) => setPromoId(e.target.value)}
                  >
                    {promotions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  disabled={pending || !promoId}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await assignCustomerPromoAction({
                        customerId: selected.id,
                        promotionId: promoId,
                      });
                      if (!result.ok) toast.error(result.error);
                      else toast.success(result.message);
                    })
                  }
                >
                  Asignar al wallet
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
