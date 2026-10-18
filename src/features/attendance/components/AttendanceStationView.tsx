"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rotateAttendanceQrAction } from "@/features/attendance/actions";

type Props = {
  locationName: string;
  scanUrl: string;
  qrImageUrl: string;
  expiresLabel: string;
};

export function AttendanceStationView({
  locationName,
  scanUrl,
  qrImageUrl,
  expiresLabel,
}: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Asistencia · QR del local
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{locationName}</p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrImageUrl}
        alt="Código QR de asistencia"
        width={360}
        height={360}
        className="rounded-xl border border-border bg-white p-3 shadow-sm"
      />

      <p className="text-sm text-muted-foreground">
        Escanea con tu celular (ya con sesión). Entrada y salida alternan.
        <br />
        Válido hasta {expiresLabel}
      </p>

      <p className="max-w-full break-all text-xs text-muted-foreground/80">
        {scanUrl}
      </p>

      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await rotateAttendanceQrAction();
            if (!result.ok) toast.error(result.error);
            else toast.success(result.message);
          })
        }
      >
        {pending ? "Renovando…" : "Renovar QR"}
      </Button>
    </div>
  );
}
