"use client";

import { useState, useTransition } from "react";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  checkInAction,
  checkOutAction,
  correctAttendanceAction,
} from "@/features/attendance/actions";

export type AttendanceRow = {
  id: string;
  employeeName: string;
  checkInLabel: string;
  checkOutLabel: string | null;
  checkInIso: string;
  checkOutIso: string | null;
  status: string;
  notes: string | null;
  isMine: boolean;
};

type Props = {
  employeeName: string | null;
  hasOpenAttendance: boolean;
  canCheck: boolean;
  canCorrect: boolean;
  todayLabel: string;
  rows: AttendanceRow[];
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "En turno",
  COMPLETE: "Completa",
  LATE: "Retardo",
  EARLY_LEAVE: "Salida temprana",
  ON_TIME: "A tiempo",
  ABSENT: "Ausente",
};

export function AttendanceView({
  employeeName,
  hasOpenAttendance,
  canCheck,
  canCorrect,
  todayLabel,
  rows,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AttendanceRow | null>(null);
  const [status, setStatus] = useState("COMPLETE");
  const [notes, setNotes] = useState("");
  const [checkInLocal, setCheckInLocal] = useState("");
  const [checkOutLocal, setCheckOutLocal] = useState("");

  function openCorrect(row: AttendanceRow) {
    setEditing(row);
    setStatus(row.status === "OPEN" ? "OPEN" : row.status);
    setNotes(row.notes ?? "");
    setCheckInLocal(toLocalInput(row.checkInIso));
    setCheckOutLocal(row.checkOutIso ? toLocalInput(row.checkOutIso) : "");
  }

  function saveCorrect() {
    if (!editing) return;
    startTransition(async () => {
      const result = await correctAttendanceAction({
        id: editing.id,
        status: status as
          | "ON_TIME"
          | "LATE"
          | "EARLY_LEAVE"
          | "COMPLETE"
          | "OPEN"
          | "ABSENT",
        notes: notes || null,
        checkInAt: checkInLocal
          ? new Date(checkInLocal).toISOString()
          : undefined,
        checkOutAt: checkOutLocal
          ? new Date(checkOutLocal).toISOString()
          : null,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setEditing(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asistencia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro de entrada y salida · {todayLabel}
          {employeeName ? ` · ${employeeName}` : ""}
        </p>
      </div>

      {canCheck ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            size="lg"
            className="h-24 text-lg font-semibold"
            disabled={pending || hasOpenAttendance}
            onClick={() =>
              startTransition(async () => {
                const result = await checkInAction();
                if (!result.ok) toast.error(result.error);
                else toast.success(result.message);
              })
            }
          >
            Registrar entrada
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-24 text-lg font-semibold"
            disabled={pending || !hasOpenAttendance}
            onClick={() =>
              startTransition(async () => {
                const result = await checkOutAction();
                if (!result.ok) toast.error(result.error);
                else toast.success(result.message);
              })
            }
          >
            Registrar salida
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No tienes permiso para registrar asistencia.
        </p>
      )}

      {hasOpenAttendance ? (
        <p className="text-sm text-[var(--pub-blue-dark)]">
          Tienes un turno abierto. Registra la salida al terminar.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asistencias de hoy</CardTitle>
          <CardDescription>
            Entradas y salidas registradas en la sucursal.
            {canCorrect
              ? " Las correcciones quedan auditadas."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay registros hoy.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Estado</TableHead>
                  {canCorrect ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.employeeName}
                      {row.isMine ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (tú)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.checkInLabel}</TableCell>
                    <TableCell>{row.checkOutLabel ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "OPEN" ? "default" : "secondary"
                        }
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    {canCorrect ? (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCorrect(row)}
                        >
                          Corregir
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Corregir asistencia — {editing?.employeeName}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Entrada</Label>
              <Input
                type="datetime-local"
                value={checkInLocal}
                onChange={(e) => setCheckInLocal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Salida</Label>
              <Input
                type="datetime-local"
                value={checkOutLocal}
                onChange={(e) => setCheckOutLocal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notas de corrección</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button disabled={pending} onClick={saveCorrect}>
              Guardar corrección
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
