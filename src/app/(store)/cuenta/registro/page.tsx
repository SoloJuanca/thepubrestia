import type { Metadata } from "next";
import { CustomerRegisterForm } from "@/features/store/components/CustomerAuthForms";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

export default function CustomerRegisterPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Queda ligada a la tienda. Con ella puedes pedir aquí y seguir comprando allá.
        </p>
      </div>
      <CustomerRegisterForm />
    </div>
  );
}
