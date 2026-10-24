import { StoreHeader } from "@/features/store/components/StoreHeader";
import { getCurrentUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const customerName = user?.type === "CUSTOMER" ? user.name : null;

  return (
    <div className="min-h-svh bg-background">
      <StoreHeader customerName={customerName} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
