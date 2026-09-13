import { notFound } from "next/navigation";
import { reviewService } from "@/services/review.service";
import { PublicReviewForm } from "@/features/reviews/components/PublicReviewForm";

type Props = { params: Promise<{ token: string }> };

export default async function PublicReviewPage({ params }: Props) {
  const { token } = await params;
  const ctx = await reviewService.getTokenContext(token);
  if (!ctx.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">{ctx.error}</p>
      </main>
    );
  }

  const restaurantName =
    ctx.token.order?.location.name ?? "The Pub GameStore";
  const tableName = ctx.token.order?.table?.name ?? null;

  if (!ctx.token) notFound();

  return (
    <main className="min-h-screen bg-muted/30 p-6">
      <PublicReviewForm
        token={token}
        restaurantName={restaurantName}
        tableName={tableName}
      />
    </main>
  );
}
