"use client";

import { useTransition } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  checkInAction,
  checkOutAction,
} from "@/features/attendance/actions";

export type AttendanceRow = {
  id: string;
  employeeName: string;
  checkInLabel: string;
  checkOutLabel: string | null;
  status: string;
  isMine: boolean;
};

type Props = {
  employeeName: string | null;
  hasOpenAttendance: boolean;
  canCheck: boolean;
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
  todayLabel,
  rows,
}: Props) {
  const [pending, startTransition] = useTransition();

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
        <p className="text-sm text-[var(--brand-blue,#2563eb)]">
          Tienes un turno abierto. Registra la salida al terminar.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asistencias de hoy</CardTitle>
          <CardDescription>
            Entradas y salidas registradas en la sucursal.
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
                        variant={row.status === "OPEN" ? "default" : "secondary"}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
