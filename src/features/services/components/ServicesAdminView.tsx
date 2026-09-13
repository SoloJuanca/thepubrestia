"use client";

import { useMemo, useState, useTransition } from "react";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  archiveServiceAction,
  completeServiceAction,
  createServiceAction,
} from "@/features/services/actions";

export type ServiceRow = {
  id: string;
  name: string;
  category: string | null;
  expectedCost: string;
  recurrenceLabel: string;
  nextDateLabel: string | null;
  lastDateLabel: string | null;
  status: string;
  overdue: boolean;
  upcoming: boolean;
  supplierName: string | null;
};

type Props = {
  locationId: string;
  canWrite: boolean;
  services: ServiceRow[];
  suppliers: Array<{ id: string; name: string }>;
};

const RECURRENCE_OPTIONS = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "BIMONTHLY", label: "Bimestral" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
  { value: "CUSTOM", label: "Personalizado (días)" },
] as const;

const emptyForm = {
  name: "",
  category: "",
  expectedCost: "",
  recurrenceType: "MONTHLY",
  recurrenceInterval: "1",
  nextServiceDate: "",
  notes: "",
  supplierId: "",
};

export function ServicesAdminView({
  locationId,
  canWrite,
  services,
  suppliers,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(emptyForm);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState({
    performedAt: new Date().toISOString().slice(0, 10),
    actualCost: "",
    notes: "",
  });

  const completing = useMemo(
    () => services.find((s) => s.id === completeId) ?? null,
    [services, completeId],
  );

  const overdue = services.filter((s) => s.overdue);
  const upcoming = services.filter((s) => s.upcoming && !s.overdue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Servicios y mantenimiento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Programación, vencimientos y registro de trabajos realizados.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vencidos</CardTitle>
            <CardDescription>Requieren atención</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-destructive">
              {overdue.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Próximos</CardTitle>
            <CardDescription>Dentro de la ventana de recordatorio</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{upcoming.length}</p>
          </CardContent>
        </Card>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo servicio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ej. Fumigación, revisión de extractores"
                />
              </div>
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  placeholder="Mantenimiento, limpieza…"
                />
              </div>
              <div className="space-y-1">
                <Label>Costo estimado</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.expectedCost}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expectedCost: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Recurrencia</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={form.recurrenceType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      recurrenceType: e.target.value,
                    }))
                  }
                >
                  {RECURRENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Intervalo</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.recurrenceInterval}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      recurrenceInterval: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Próxima fecha</Label>
                <Input
                  type="date"
                  value={form.nextServiceDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      nextServiceDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Proveedor</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={form.supplierId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, supplierId: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                />
              </div>
              <Button
                className="sm:col-span-2"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await createServiceAction({
                      locationId,
                      name: form.name,
                      category: form.category || null,
                      expectedCost: Number(form.expectedCost) || 0,
                      recurrenceType: form.recurrenceType,
                      recurrenceInterval: Number(form.recurrenceInterval) || 1,
                      nextServiceDate: form.nextServiceDate || null,
                      supplierId: form.supplierId || null,
                      notes: form.notes || null,
                    });
                    if (!result.ok) toast.error(result.error);
                    else {
                      toast.success(result.message);
                      setForm(emptyForm);
                    }
                  })
                }
              >
                Crear servicio
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            Vencidos, próximos y activos programados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay servicios registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Próxima</TableHead>
                  <TableHead>Costo est.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[s.category, s.recurrenceLabel, s.supplierName]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{s.nextDateLabel ?? "—"}</div>
                      {s.lastDateLabel ? (
                        <div className="text-xs text-muted-foreground">
                          Última: {s.lastDateLabel}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>${s.expectedCost}</TableCell>
                    <TableCell>
                      {s.overdue ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : s.upcoming ? (
                        <Badge>Próximo</Badge>
                      ) : (
                        <Badge variant="secondary">
                          {s.status === "ACTIVE"
                            ? "Activo"
                            : s.status === "PAUSED"
                              ? "Pausado"
                              : "Archivado"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {canWrite && s.status === "ACTIVE" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => {
                              setCompleteId(s.id);
                              setCompleteForm({
                                performedAt: new Date()
                                  .toISOString()
                                  .slice(0, 10),
                                actualCost: s.expectedCost,
                                notes: "",
                              });
                            }}
                          >
                            Completar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const result = await archiveServiceAction({
                                  id: s.id,
                                });
                                if (!result.ok) toast.error(result.error);
                                else toast.success(result.message);
                              })
                            }
                          >
                            Archivar
                          </Button>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={!!completeId}
        onOpenChange={(open) => {
          if (!open) setCompleteId(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              Completar {completing?.name ?? "servicio"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 p-1">
            <div className="space-y-1">
              <Label>Fecha de realización</Label>
              <Input
                type="date"
                value={completeForm.performedAt}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    performedAt: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Costo real</Label>
              <Input
                type="number"
                min={0}
                value={completeForm.actualCost}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    actualCost: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea
                value={completeForm.notes}
                onChange={(e) =>
                  setCompleteForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              disabled={pending || !completeId}
              onClick={() =>
                startTransition(async () => {
                  if (!completeId) return;
                  const result = await completeServiceAction({
                    serviceId: completeId,
                    performedAt: completeForm.performedAt,
                    actualCost: Number(completeForm.actualCost) || 0,
                    notes: completeForm.notes || null,
                  });
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success(result.message);
                    setCompleteId(null);
                  }
                })
              }
            >
              Guardar y registrar gasto
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
