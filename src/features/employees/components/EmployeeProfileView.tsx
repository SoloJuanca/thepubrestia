"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CompensationType,
  RoleCode,
  Weekday,
} from "@prisma/client";
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
  updateEmployeeAction,
  upsertEmployeeCompensationAction,
  upsertEmployeeScheduleAction,
  createTimeOffAction,
  deleteTimeOffAction,
} from "@/features/employees/actions";

type ScheduleDay = {
  weekday: Weekday;
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
};

type AttendanceRow = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  status: string;
  notes: string | null;
};

type TimeOffRow = {
  id: string;
  type: string;
  dateLabel: string;
  notes: string | null;
};

type Props = {
  employee: {
    id: string;
    name: string | null;
    email: string;
    active: boolean;
    role: RoleCode | string;
    profileId: string;
    phone: string | null;
    jobTitle: string | null;
    locationId: string;
    locationName: string;
    hireDate: string | null;
  };
  roles: Array<{ code: RoleCode; name: string }>;
  schedule: ScheduleDay[];
  compensation: {
    type: CompensationType;
    amount: string;
    bonuses: string;
    tipsNotes: string | null;
    notes: string | null;
  } | null;
  attendance: AttendanceRow[];
  timeOffs: TimeOffRow[];
};

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

const TIME_OFF_LABELS: Record<string, string> = {
  WEEKLY_OFF: "Día libre semanal",
  ABSENCE: "Ausencia",
  VACATION: "Vacaciones",
  PERMISSION: "Permiso",
  SICK: "Incapacidad",
};

const TABS = [
  "Perfil",
  "Horario",
  "Compensación",
  "Asistencia",
  "Ausencias",
] as const;

export function EmployeeProfileView({
  employee,
  roles,
  schedule: initialSchedule,
  compensation: initialComp,
  attendance,
  timeOffs,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Perfil");
  const [pending, startTransition] = useTransition();
  const [timeOffType, setTimeOffType] = useState("VACATION");
  const [timeOffDate, setTimeOffDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [timeOffNotes, setTimeOffNotes] = useState("");
  const [profile, setProfile] = useState({
    name: employee.name ?? "",
    phone: employee.phone ?? "",
    jobTitle: employee.jobTitle ?? "",
    roleCode: employee.role as RoleCode,
  });
  const [schedule, setSchedule] = useState(initialSchedule);
  const [comp, setComp] = useState({
    type: (initialComp?.type ?? "MONTHLY") as CompensationType,
    amount: initialComp?.amount ?? "0",
    bonuses: initialComp?.bonuses ?? "0",
    tipsNotes: initialComp?.tipsNotes ?? "",
    notes: initialComp?.notes ?? "",
  });

  function saveProfile() {
    startTransition(async () => {
      const result = await updateEmployeeAction({
        id: employee.id,
        name: profile.name,
        phone: profile.phone || null,
        jobTitle: profile.jobTitle || null,
        roleCode: profile.roleCode,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Perfil actualizado");
    });
  }

  function saveSchedule() {
    startTransition(async () => {
      const result = await upsertEmployeeScheduleAction({
        employeeProfileId: employee.profileId,
        days: schedule,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Horario guardado");
    });
  }

  function saveComp() {
    startTransition(async () => {
      const result = await upsertEmployeeCompensationAction({
        employeeProfileId: employee.profileId,
        type: comp.type,
        amount: Number(comp.amount) || 0,
        bonuses: Number(comp.bonuses) || 0,
        tipsNotes: comp.tipsNotes || null,
        notes: comp.notes || null,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Compensación guardada");
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/employees"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Empleados
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {employee.name ?? employee.email}
          </h1>
          <Badge variant={employee.active ? "default" : "secondary"}>
            {employee.active ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {employee.locationName} · {employee.email}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-lg bg-[var(--pub-blue)] px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Perfil" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del empleado</CardTitle>
            <CardDescription>Información básica y rol</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Puesto</Label>
              <Input
                value={profile.jobTitle}
                onChange={(e) =>
                  setProfile({ ...profile, jobTitle: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={profile.roleCode}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    roleCode: e.target.value as RoleCode,
                  })
                }
              >
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button disabled={pending} onClick={saveProfile}>
                Guardar perfil
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "Horario" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horario semanal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {schedule.map((d, idx) => (
              <div
                key={d.weekday}
                className="grid grid-cols-[6rem_auto_1fr_1fr] items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm font-medium">
                  {WEEKDAY_LABELS[d.weekday]}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={d.isDayOff}
                    onChange={(e) => {
                      const next = [...schedule];
                      next[idx] = {
                        ...d,
                        isDayOff: e.target.checked,
                        startTime: e.target.checked
                          ? null
                          : d.startTime ?? "10:00",
                        endTime: e.target.checked ? null : d.endTime ?? "18:00",
                      };
                      setSchedule(next);
                    }}
                  />
                  Descanso
                </label>
                <Input
                  type="time"
                  disabled={d.isDayOff}
                  value={d.startTime ?? ""}
                  onChange={(e) => {
                    const next = [...schedule];
                    next[idx] = { ...d, startTime: e.target.value };
                    setSchedule(next);
                  }}
                />
                <Input
                  type="time"
                  disabled={d.isDayOff}
                  value={d.endTime ?? ""}
                  onChange={(e) => {
                    const next = [...schedule];
                    next[idx] = { ...d, endTime: e.target.value };
                    setSchedule(next);
                  }}
                />
              </div>
            ))}
            <Button disabled={pending} onClick={saveSchedule}>
              Guardar horario
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === "Compensación" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compensación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={comp.type}
                onChange={(e) =>
                  setComp({
                    ...comp,
                    type: e.target.value as CompensationType,
                  })
                }
              >
                <option value="MONTHLY">Mensual</option>
                <option value="BIWEEKLY">Quincenal</option>
                <option value="WEEKLY">Semanal</option>
                <option value="HOURLY">Por hora</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={comp.amount}
                onChange={(e) => setComp({ ...comp, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bonos</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={comp.bonuses}
                onChange={(e) => setComp({ ...comp, bonuses: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                value={comp.notes}
                onChange={(e) => setComp({ ...comp, notes: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button disabled={pending} onClick={saveComp}>
                Guardar compensación
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "Asistencia" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial reciente</CardTitle>
            <CardDescription>
              Correcciones desde el módulo de asistencia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin registros.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.checkInAt}</TableCell>
                      <TableCell>{a.checkOutAt ?? "—"}</TableCell>
                      <TableCell>{a.status}</TableCell>
                      <TableCell>{a.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "Ausencias" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Días libres y ausencias</CardTitle>
            <CardDescription>
              Distinto del descanso semanal del horario. No cuenta un día libre
              planeado como ausencia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2 sm:col-span-1">
                <Label>Tipo</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={timeOffType}
                  onChange={(e) => setTimeOffType(e.target.value)}
                >
                  {Object.entries(TIME_OFF_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={timeOffDate}
                  onChange={(e) => setTimeOffDate(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notas</Label>
                <Input
                  value={timeOffNotes}
                  onChange={(e) => setTimeOffNotes(e.target.value)}
                />
              </div>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await createTimeOffAction({
                    employeeProfileId: employee.profileId,
                    locationId: employee.locationId,
                    type: timeOffType,
                    date: timeOffDate,
                    notes: timeOffNotes || null,
                  });
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success(result.message);
                    setTimeOffNotes("");
                  }
                })
              }
            >
              Registrar
            </Button>

            {timeOffs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin registros.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeOffs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.dateLabel}</TableCell>
                      <TableCell>
                        {TIME_OFF_LABELS[t.type] ?? t.type}
                      </TableCell>
                      <TableCell>{t.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await deleteTimeOffAction(t.id);
                              if (!result.ok) toast.error(result.error);
                              else toast.success(result.message);
                            })
                          }
                        >
                          Quitar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
