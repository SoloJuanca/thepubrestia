import { requirePermission } from "@/lib/rbac";
import type { PermissionResource } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  phase: string;
  resource: PermissionResource;
};

export async function ComingSoonPage({
  title,
  description,
  phase,
  resource,
}: Props) {
  await requirePermission(resource, "read");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Próximamente</CardTitle>
          <CardDescription>{phase}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            El esquema de datos y permisos ya están listos. Esta UI se
            implementará en la fase indicada sin mocks desconectados del
            backend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
