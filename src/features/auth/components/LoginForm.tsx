"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
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
import { BRAND } from "@/lib/brand";

type StaffLogin = { name: string; email: string };

type LoginFormProps = {
  callbackUrl?: string;
  staff?: StaffLogin[];
};

export function LoginForm({
  callbackUrl = "/post-login",
  staff = [],
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Drop stale JWT cookies encrypted with a previous AUTH_SECRET
      await signOut({ redirect: false });

      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Credenciales inválidas o usuario inactivo.");
        setLoading(false);
        return;
      }

      const next =
        callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
          ? callbackUrl
          : "/post-login";
      window.location.assign(next);
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-border/60 shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl tracking-tight">{BRAND.name}</CardTitle>
        <CardDescription>
          Elige tu nombre o escribe el correo. Contraseña temporal: la que te
          dieron al crear la cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          {staff.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Personal</p>
              <div className="flex flex-wrap gap-2">
                {staff.map((person) => {
                  const selected = email.trim().toLowerCase() === person.email;
                  return (
                    <button
                      key={person.email}
                      type="button"
                      onClick={() => {
                        setEmail(person.email);
                        setError(null);
                      }}
                      className={
                        selected
                          ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                          : "rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                      }
                    >
                      {person.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Correo o nombre</Label>
            <Input
              id="email"
              name="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore
              placeholder="mer"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Iniciar sesión"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
