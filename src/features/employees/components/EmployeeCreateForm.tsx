"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CompensationType, RoleCode, Weekday } from "@prisma/client";
import { toast } from "sonner";
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
import { createEmployeeAction } from "@/features/employees/actions";
import { permissionsForRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const WEEKDAYS: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const JOB_TITLES = [
  "Administrador",
  "Gerente",
  "Mesero",
  "Cocina",
  "Auxiliar cocina",
  "Bartender",
  "Caja",
  "Otro",
] as const;

const MATRIX_RESOURCES = [
  { resource: "pos", label: "POS" },
  { resource: "inventory", label: "Inventario" },
  { resource: "purchases", label: "Pedidos" },
  { resource: "employees", label: "Empleados" },
  { resource: "finance", label: "Finanzas" },
  { resource: "attendance", label: "Asistencia" },
  { resource: "services", label: "Servicios" },
] as const;

type Props = {
  roles: Array<{ code: RoleCode; name: string }>;
  locations: Array<{ id: string; name: string }>;
};

const STEPS = [
  "Datos",
  "Empleo",
  "Salario",
  "Horario",
  "Permisos",
  "Acceso",
] as const;

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Lun",
  TUESDAY: "Mar",
  WEDNESDAY: "Mié",
  THURSDAY: "Jue",
  FRIDAY: "Vie",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

type ScheduleDay = {
  weekday: Weekday;
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
};

function defaultSchedule(): ScheduleDay[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    startTime: weekday === "SUNDAY" ? null : "10:00",
    endTime: weekday === "SUNDAY" ? null : "18:00",
    isDayOff: weekday === "SUNDAY",
  }));
}

function accessLabel(
  perms: Array<{ resource: string; action: string }>,
  resource: string,
) {
  const canUpdate = perms.some(
    (p) => p.resource === resource && (p.action === "update" || p.action === "create"),
  );
  const canRead = perms.some(
    (p) => p.resource === resource && p.action === "read",
  );
  if (canUpdate) return "Ver / Editar";
  if (canRead) return "Solo ver";
  return "Sin acceso";
}

export function EmployeeCreateForm({ roles, locations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [customJob, setCustomJob] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    jobTitle: "Mesero",
    hireDate: new Date().toISOString().slice(0, 10),
    password: "",
    roleCode: (roles[0]?.code ?? "WAITER") as RoleCode,
    locationId: locations[0]?.id ?? "",
    schedule: defaultSchedule(),
    compensation: {
      type: "MONTHLY" as CompensationType,
      amount: "0",
      bonuses: "0",
      tipsNotes: "",
      notes: "",
    },
  });

  const rolePerms = useMemo(
    () => permissionsForRole(form.roleCode),
    [form.roleCode],
  );

  const canNext = useMemo(() => {
    if (step === 0) return form.name.trim().length >= 2 && form.email.includes("@");
    if (step === 1) return Boolean(form.locationId && form.roleCode && form.jobTitle);
    if (step === 5) return form.password.length >= 8;
    return true;
  }, [step, form]);

  function updateDay(weekday: Weekday, patch: Partial<ScheduleDay>) {
    setForm((f) => ({
      ...f,
      schedule: f.schedule.map((d) =>
        d.weekday === weekday ? { ...d, ...patch } : d,
      ),
    }));
  }

  function onSubmit() {
    startTransition(async () => {
      const result = await createEmployeeAction({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        roleCode: form.roleCode,
        locationId: form.locationId,
        jobTitle: form.jobTitle || null,
        hireDate: form.hireDate || null,
        schedule: form.schedule,
        compensation: {
          type: form.compensation.type,
          amount: Number(form.compensation.amount) || 0,
          bonuses: Number(form.compensation.bonuses) || 0,
          tipsNotes: form.compensation.tipsNotes || null,
          notes: form.compensation.notes || null,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Creado");
      if (result.id) router.push(`/employees/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nuevo empleado</CardTitle>
        <CardDescription>
          Paso {step + 1} de {STEPS.length}: {STEPS[step]}
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-1">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                i === step
                  ? "bg-[var(--pub-blue)] text-white"
                  : i < step
                    ? "bg-[var(--pub-blue)]/15 text-[var(--pub-blue-dark)]"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Correo">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Puesto">
              <div className="flex flex-wrap gap-1">
                {JOB_TITLES.map((title) => (
                  <button
                    key={title}
                    type="button"
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium",
                      form.jobTitle === title ||
                        (title === "Otro" && customJob)
                        ? "bg-[var(--pub-blue)] text-white"
                        : "bg-muted",
                    )}
                    onClick={() => {
                      if (title === "Otro") {
                        setCustomJob(true);
                        setForm({ ...form, jobTitle: "" });
                      } else {
                        setCustomJob(false);
                        setForm({ ...form, jobTitle: title });
                      }
                    }}
                  >
                    {title}
                  </button>
                ))}
              </div>
              {customJob ? (
                <Input
                  className="mt-2"
                  placeholder="Especificar puesto"
                  value={form.jobTitle}
                  onChange={(e) =>
                    setForm({ ...form, jobTitle: e.target.value })
                  }
                />
              ) : null}
            </Field>
            <Field label="Fecha de ingreso">
              <Input
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              />
            </Field>
            <Field label="Rol del sistema">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.roleCode}
                onChange={(e) =>
                  setForm({ ...form, roleCode: e.target.value as RoleCode })
                }
              >
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sucursal">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.locationId}
                onChange={(e) =>
                  setForm({ ...form, locationId: e.target.value })
                }
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de pago">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.compensation.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    compensation: {
                      ...form.compensation,
                      type: e.target.value as CompensationType,
                    },
                  })
                }
              >
                <option value="MONTHLY">Mensual</option>
                <option value="BIWEEKLY">Quincenal</option>
                <option value="WEEKLY">Semanal</option>
                <option value="HOURLY">Por hora</option>
              </select>
            </Field>
            <Field label="Monto base">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.compensation.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    compensation: {
                      ...form.compensation,
                      amount: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Bonos">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.compensation.bonuses}
                onChange={(e) =>
                  setForm({
                    ...form,
                    compensation: {
                      ...form.compensation,
                      bonuses: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Notas de propinas">
              <Input
                value={form.compensation.tipsNotes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    compensation: {
                      ...form.compensation,
                      tipsNotes: e.target.value,
                    },
                  })
                }
              />
            </Field>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-2">
            {form.schedule.map((d) => (
              <div
                key={d.weekday}
                className="grid grid-cols-[3.5rem_auto_1fr_1fr] items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm font-medium">
                  {WEEKDAY_LABELS[d.weekday]}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={d.isDayOff}
                    onChange={(e) =>
                      updateDay(d.weekday, {
                        isDayOff: e.target.checked,
                        startTime: e.target.checked
                          ? null
                          : (d.startTime ?? "10:00"),
                        endTime: e.target.checked
                          ? null
                          : (d.endTime ?? "18:00"),
                      })
                    }
                  />
                  Día libre
                </label>
                <Input
                  type="time"
                  disabled={d.isDayOff}
                  value={d.startTime ?? ""}
                  onChange={(e) =>
                    updateDay(d.weekday, { startTime: e.target.value })
                  }
                />
                <Input
                  type="time"
                  disabled={d.isDayOff}
                  value={d.endTime ?? ""}
                  onChange={(e) =>
                    updateDay(d.weekday, { endTime: e.target.value })
                  }
                />
              </div>
            ))}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Matriz derivada del rol{" "}
              <strong>
                {roles.find((r) => r.code === form.roleCode)?.name}
              </strong>{" "}
              (solo lectura).
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Módulo</th>
                    <th className="px-3 py-2 text-left font-medium">Acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {MATRIX_RESOURCES.map((row) => (
                    <tr key={row.resource} className="border-t border-border">
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {accessLabel(rolePerms, row.resource)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <div className="max-w-sm space-y-2">
              <Label>Contraseña temporal</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres. Entrégala al empleado para su primer acceso.
              </p>
            </div>
            <div className="space-y-2 rounded-xl border border-border bg-surface-secondary/50 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Nombre:</span>{" "}
                {form.name}
              </p>
              <p>
                <span className="text-muted-foreground">Puesto:</span>{" "}
                {form.jobTitle}
              </p>
              <p>
                <span className="text-muted-foreground">Rol:</span>{" "}
                {roles.find((r) => r.code === form.roleCode)?.name}
              </p>
              <p>
                <span className="text-muted-foreground">Sucursal:</span>{" "}
                {locations.find((l) => l.id === form.locationId)?.name}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || pending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Atrás
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              disabled={!canNext || pending}
              onClick={() => setStep((s) => s + 1)}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canNext || pending}
              onClick={onSubmit}
            >
              {pending ? "Guardando…" : "Crear empleado"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
