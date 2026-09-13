import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | typeof prisma;

export class CustomerService {
  async upsertByEmail(params: {
    email: string;
    name?: string | null;
    phone?: string | null;
  }) {
    const email = params.email.trim().toLowerCase();
    const user =
      (await prisma.user.findUnique({ where: { email } })) ??
      (await prisma.user.create({
        data: {
          email,
          name: params.name?.trim() || email.split("@")[0],
          type: "CUSTOMER",
          active: true,
        },
      }));

    if (user.type !== "CUSTOMER" && user.type !== "EMPLOYEE") {
      throw new Error("Usuario inválido.");
    }

    // Allow linking employee emails as customers only if profile exists as customer type
    if (user.type === "EMPLOYEE") {
      throw new Error("Ese email pertenece a un empleado.");
    }

    return prisma.customerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        phone: params.phone ?? null,
      },
      update: {
        phone: params.phone === undefined ? undefined : params.phone,
      },
      include: { user: true },
    });
  }

  async updateProfile(params: {
    id: string;
    phone?: string | null;
    name?: string | null;
  }) {
    const profile = await prisma.customerProfile.findUnique({
      where: { id: params.id },
    });
    if (!profile) throw new Error("Cliente no encontrado.");

    if (params.name != null) {
      await prisma.user.update({
        where: { id: profile.userId },
        data: { name: params.name.trim() || null },
      });
    }

    return prisma.customerProfile.update({
      where: { id: params.id },
      data: {
        phone: params.phone === undefined ? undefined : params.phone,
      },
      include: { user: true },
    });
  }

  async assignPromotion(params: {
    customerId: string;
    promotionId: string;
    expiresAt?: Date | null;
    assignedById?: string | null;
  }) {
    const [customer, promo] = await Promise.all([
      prisma.customerProfile.findUnique({ where: { id: params.customerId } }),
      prisma.promotion.findUnique({ where: { id: params.promotionId } }),
    ]);
    if (!customer) throw new Error("Cliente no encontrado.");
    if (!promo) throw new Error("Promoción no encontrada.");

    return prisma.customerPromotion.create({
      data: {
        customerId: params.customerId,
        promotionId: params.promotionId,
        expiresAt: params.expiresAt ?? null,
        assignedById: params.assignedById ?? null,
      },
    });
  }

  async recordSpendOnClose(
    params: { customerId: string; amount: number },
    client: Tx = prisma,
  ) {
    if (params.amount < 0) return;
    await client.customerProfile.update({
      where: { id: params.customerId },
      data: {
        visits: { increment: 1 },
        lifetimeSpend: { increment: params.amount },
        lastVisitAt: new Date(),
      },
    });
  }

  async attachToCheck(params: {
    checkId: string;
    customerId: string | null;
  }) {
    const check = await prisma.check.findUnique({ where: { id: params.checkId } });
    if (!check) throw new Error("Cuenta no encontrada.");
    if (check.status !== "OPEN") {
      throw new Error("Solo cuentas abiertas.");
    }
    if (params.customerId) {
      const customer = await prisma.customerProfile.findUnique({
        where: { id: params.customerId },
      });
      if (!customer) throw new Error("Cliente no encontrado.");
    }
    return prisma.check.update({
      where: { id: params.checkId },
      data: { customerId: params.customerId },
    });
  }
}

export const customerService = new CustomerService();
