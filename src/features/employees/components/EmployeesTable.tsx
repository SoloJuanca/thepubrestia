"use client";

import { useTransition } from "react";
import Link from "next/link";
import { RoleCode } from "@prisma/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deactivateEmployeeAction,
  updateEmployeeAction,
} from "@/features/employees/actions";
import { cn } from "@/lib/utils";

type EmployeeRow = {
  id: string;
  name: string | null;
  email: string;
  active: boolean;
  role: string;
  location: string;
  phone: string | null;
};

type Props = {
  employees: EmployeeRow[];
  roles: Array<{ code: RoleCode; name: string }>;
};

export function EmployeesTable({ employees, roles }: Props) {
  const [pending, startTransition] = useTransition();

  function setRole(id: string, roleCode: RoleCode) {
    startTransition(async () => {
      const result = await updateEmployeeAction({ id, roleCode });
      if (!result.ok) toast.error(result.error);
      else toast.success("Rol actualizado");
    });
  }

  function deactivate(id: string) {
    startTransition(async () => {
      const result = await deactivateEmployeeAction(id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Empleado desactivado");
    });
  }

  return (
    <div className="rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.name ?? "—"}</TableCell>
              <TableCell>{e.email}</TableCell>
              <TableCell>{e.location}</TableCell>
              <TableCell>
                <select
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={e.role}
                  disabled={pending}
                  onChange={(ev) =>
                    setRole(e.id, ev.target.value as RoleCode)
                  }
                >
                  {roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <Badge variant={e.active ? "default" : "secondary"}>
                  {e.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="space-x-2 text-right">
                <Link
                  href={`/employees/${e.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Perfil
                </Link>
                {e.active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => deactivate(e.id)}
                  >
                    Desactivar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await updateEmployeeAction({
                          id: e.id,
                          active: true,
                        });
                        if (!result.ok) toast.error(result.error);
                        else toast.success("Empleado reactivado");
                      })
                    }
                  >
                    Reactivar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
