import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export class ReviewService {
  async mintToken(params: {
    orderId?: string | null;
    expiresInDays?: number;
  }) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays ?? 14));

    return prisma.reviewToken.create({
      data: {
        token: randomBytes(24).toString("hex"),
        orderId: params.orderId ?? null,
        expiresAt,
      },
    });
  }

  async getTokenContext(token: string) {
    const row = await prisma.reviewToken.findUnique({
      where: { token },
      include: {
        order: {
          include: {
            location: true,
            table: true,
            waiter: true,
          },
        },
      },
    });
    if (!row) return { ok: false as const, error: "Token inválido." };
    if (row.usedAt) return { ok: false as const, error: "Este enlace ya fue usado." };
    if (row.expiresAt < new Date()) {
      return { ok: false as const, error: "Este enlace expiró." };
    }
    return { ok: true as const, token: row };
  }

  async submit(params: {
    token: string;
    overallRating: number;
    foodRating?: number | null;
    serviceRating?: number | null;
    ambienceRating?: number | null;
    comment?: string | null;
    guestName?: string | null;
    guestEmail?: string | null;
  }) {
    if (params.overallRating < 1 || params.overallRating > 5) {
      throw new Error("Calificación inválida.");
    }

    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          token: string;
          orderId: string | null;
          expiresAt: Date;
          usedAt: Date | null;
        }>
      >`
        SELECT id, token, "orderId", "expiresAt", "usedAt"
        FROM "ReviewToken"
        WHERE token = ${params.token}
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row) throw new Error("Token inválido.");
      if (row.usedAt) throw new Error("Este enlace ya fue usado.");
      if (row.expiresAt < new Date()) throw new Error("Este enlace expiró.");

      let locationId: string | null = null;
      let tableId: string | null = null;
      let waiterId: string | null = null;
      let customerId: string | null = null;

      if (row.orderId) {
        const order = await tx.order.findUnique({
          where: { id: row.orderId },
          include: {
            checks: { where: { customerId: { not: null } }, take: 1 },
          },
        });
        if (order) {
          locationId = order.locationId;
          tableId = order.tableId;
          waiterId = order.waiterId;
          customerId = order.checks[0]?.customerId ?? null;
        }
      }

      if (!locationId) {
        const location = await tx.location.findFirst({
          where: { active: true },
          orderBy: { createdAt: "asc" },
        });
        locationId = location?.id ?? null;
      }
      if (!locationId) throw new Error("Sin sucursal para la reseña.");

      const review = await tx.review.create({
        data: {
          locationId,
          orderId: row.orderId,
          tableId,
          waiterId,
          customerId,
          reviewTokenId: row.id,
          overallRating: params.overallRating,
          foodRating: params.foodRating ?? null,
          serviceRating: params.serviceRating ?? null,
          ambienceRating: params.ambienceRating ?? null,
          comment: params.comment ?? null,
          guestName: params.guestName ?? null,
          guestEmail: params.guestEmail ?? null,
        },
      });

      await tx.reviewToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });

      return review;
    });
  }

  async dashboard(locationId: string) {
    const [reviews, avg, byWaiter] = await Promise.all([
      prisma.review.findMany({
        where: { locationId },
        include: {
          waiter: true,
          table: true,
          customer: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.review.aggregate({
        where: { locationId },
        _avg: {
          overallRating: true,
          foodRating: true,
          serviceRating: true,
          ambienceRating: true,
        },
        _count: true,
      }),
      prisma.review.groupBy({
        by: ["waiterId"],
        where: { locationId, waiterId: { not: null } },
        _avg: { overallRating: true },
        _count: true,
      }),
    ]);

    return { reviews, avg, byWaiter };
  }
}

export const reviewService = new ReviewService();
