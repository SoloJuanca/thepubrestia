import type { Metadata } from "next";
import Link from "next/link";
import { CustomerLoginForm } from "@/features/store/components/CustomerAuthForms";
import { STAFF_LOGIN_PATH } from "@/lib/auth-paths";
import { safeCustomerPath } from "@/validations/store";

export const metadata: Metadata = {
  title: "Entrar",
};

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function CustomerLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = safeCustomerPath(params.callbackUrl);

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entra para pedir</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Usa la misma cuenta con la que compras en la tienda.
        </p>
      </div>
      <CustomerLoginForm callbackUrl={callbackUrl} />
      <p className="text-center text-xs text-muted-foreground">
        ¿Trabajas aquí?{" "}
        <Link href={STAFF_LOGIN_PATH} className="underline underline-offset-2">
          Acceso del personal
        </Link>
      </p>
    </div>
  );
}
