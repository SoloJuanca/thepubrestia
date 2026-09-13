import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.35_0.06_55)_0%,_oklch(0.16_0.02_50)_45%,_oklch(0.12_0.01_40)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(oklch(1_0_0_/0.04)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0_/0.04)_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={<div className="text-white">Cargando…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
