"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { CUSTOMER_LOGIN_PATH } from "@/lib/auth-paths";
import { BRAND } from "@/lib/brand";

type Props = {
  customerName?: string | null;
};

export function StoreHeader({ customerName }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/pedir" className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight text-[var(--pub-blue-dark)]">
            {BRAND.name}
          </span>
          <span className="block text-xs text-muted-foreground">Pide y recoge</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm" aria-label="Cuenta">
          {customerName ? (
            <>
              <Link
                href="/cuenta/pedidos"
                className="rounded-lg px-2.5 py-2 font-medium hover:bg-muted"
              >
                Mis pedidos
              </Link>
              <span className="hidden max-w-32 truncate text-muted-foreground sm:inline">
                {customerName}
              </span>
              <button
                type="button"
                className="rounded-lg px-2.5 py-2 font-medium text-[var(--pub-blue)] hover:bg-muted"
                onClick={() => signOut({ redirectTo: CUSTOMER_LOGIN_PATH })}
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link
                href={CUSTOMER_LOGIN_PATH}
                className="rounded-lg px-2.5 py-2 font-medium hover:bg-muted"
              >
                Entrar
              </Link>
              <Link
                href="/cuenta/registro"
                className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
