import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
  await requirePermission("settings", "read");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const taxRate = await prisma.menuItem.aggregate({
    where: { locationId: location?.id, active: true },
    _avg: { taxRate: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preferencias de sucursal (lectura). Edición avanzada pendiente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sucursal activa</CardTitle>
          <CardDescription>
            {location?.name ?? "Sin sucursal — ejecuta el seed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Dirección: </span>
            {location?.address ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Teléfono: </span>
            {location?.phone ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">TZ: </span>
            {location?.timezone ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">IVA promedio menú: </span>
            {taxRate._avg.taxRate != null
              ? `${(Number(taxRate._avg.taxRate) * 100).toFixed(1)}%`
              : "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
