"use client";

import { useState, useTransition } from "react";
import { RoleCode } from "@prisma/client";
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

type Props = {
  roles: Array<{ code: RoleCode; name: string }>;
  locations: Array<{ id: string; name: string }>;
};

export function EmployeeCreateForm({ roles, locations }: Props) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    roleCode: (roles[0]?.code ?? "WAITER") as RoleCode,
    locationId: locations[0]?.id ?? "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createEmployeeAction(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Creado");
      setForm((f) => ({
        ...f,
        name: "",
        email: "",
        phone: "",
        password: "",
      }));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nuevo empleado</CardTitle>
        <CardDescription>
          Requiere permiso employees:create (validado en servidor)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña temporal</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <select
              id="role"
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Sucursal</Label>
            <select
              id="location"
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
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={pending || !form.locationId}>
              {pending ? "Guardando…" : "Crear empleado"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
