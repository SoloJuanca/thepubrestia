import { LoginForm } from "@/features/auth/components/LoginForm";

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

function safeCallbackUrl(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

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
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
