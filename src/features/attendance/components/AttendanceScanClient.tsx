"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { scanAttendanceQrAction } from "@/features/attendance/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { token: string };

export function AttendanceScanClient({ token }: Props) {
  const [message, setMessage] = useState("Registrando asistencia…");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"in" | "out" | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const result = await scanAttendanceQrAction(token);
      if (!result.ok) {
        setError(result.error);
        setMessage("No se pudo registrar.");
        return;
      }
      setMode(result.mode ?? null);
      setMessage(result.message ?? "Listo.");
    })();
  }, [token]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Asistencia QR</h1>
      <p className={error ? "text-destructive" : "text-muted-foreground"}>
        {error ?? message}
      </p>
      {mode ? (
        <p className="text-sm font-medium">
          {mode === "in" ? "Entrada registrada" : "Salida registrada"}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/attendance"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Ver asistencia
        </Link>
        <Link href="/kitchen" className={cn(buttonVariants())}>
          Ir a cocina
        </Link>
      </div>
    </div>
  );
}
