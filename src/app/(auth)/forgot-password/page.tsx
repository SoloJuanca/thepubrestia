export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recuperar contraseña
        </h1>
        <p className="text-muted-foreground">
          Pide a un administrador que reinicie tu contraseña desde Empleados →
          perfil → Contraseña. Luego cámbiala en Mi cuenta al iniciar sesión.
        </p>
      </div>
    </main>
  );
}
