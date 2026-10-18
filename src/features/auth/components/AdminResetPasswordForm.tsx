"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminResetPasswordAction } from "@/features/auth/actions";

type Props = {
  userId: string;
  email: string;
};

export function AdminResetPasswordForm({ userId, email }: Props) {
  const [pending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await adminResetPasswordAction({
        userId,
        newPassword,
        confirmPassword,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setNewPassword("");
      setConfirmPassword("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Define una contraseña temporal para <strong>{email}</strong>. El
        empleado podrá cambiarla en Mi cuenta.
      </p>
      <div className="space-y-2">
        <Label htmlFor="admin-new-password">Nueva contraseña</Label>
        <Input
          id="admin-new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-confirm-password">Confirmar</Label>
        <Input
          id="admin-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Guardando…" : "Reiniciar contraseña"}
      </Button>
    </form>
  );
}
