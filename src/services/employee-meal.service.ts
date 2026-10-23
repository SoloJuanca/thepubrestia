import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { locationServiceDate } from "@/lib/service-date";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Recibida",
  SENT_TO_KITCHEN: "En cocina",
  PREPARING: "Preparando",
  READY: "Lista",
  DELIVERED: "Entregada",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export function mealStatusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

export class EmployeeMealService {
  async today(locationId: string, timeZone: string, userId: string) {
    const serviceDate = locationServiceDate(timeZone);
    const meal = await prisma.employeeMeal.findUnique({
      where: { locationId_serviceDate: { locationId, serviceDate } },
      include: {
        orders: {
          include: {
            user: { select: { id: true, name: true } },
            order: {
              include: {
                checks: { include: { items: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const mine = meal?.orders.find((row) => row.userId === userId) ?? null;
    const itemStatus = mine?.order.checks[0]?.items[0]?.status ?? mine?.order.status;

    return {
      serviceDate,
      meal: meal
        ? { id: meal.id, name: meal.name, notes: meal.notes }
        : null,
      mine: mine
        ? {
            orderId: mine.orderId,
            status: itemStatus ?? mine.order.status,
            label: mealStatusLabel(itemStatus ?? mine.order.status),
          }
        : null,
      orders: (meal?.orders ?? []).map((row) => ({
        id: row.id,
        name: row.user.name ?? "Empleado",
        status: mealStatusLabel(
          row.order.checks[0]?.items[0]?.status ?? row.order.status,
        ),
      })),
    };
  }

  async setToday(params: {
    locationId: string;
    timeZone: string;
    userId: string;
    name: string;
    notes?: string | null;
  }) {
    const name = params.name.trim();
    if (name.length < 2) throw new Error("Escribe el nombre de la comida.");
    const serviceDate = locationServiceDate(params.timeZone);
    return prisma.employeeMeal.upsert({
      where: {
        locationId_serviceDate: {
          locationId: params.locationId,
          serviceDate,
        },
      },
      create: {
        locationId: params.locationId,
        serviceDate,
        name,
        notes: params.notes?.trim() || null,
        createdById: params.userId,
      },
      update: {
        name,
        notes: params.notes?.trim() || null,
      },
    });
  }

  async orderMine(params: {
    locationId: string;
    timeZone: string;
    userId: string;
    employeeName: string;
    profileActive: boolean | null;
  }) {
    if (params.profileActive === false) {
      throw new Error("Tu cuenta de empleado está inactiva.");
    }

    const serviceDate = locationServiceDate(params.timeZone);
    const meal = await prisma.employeeMeal.findUnique({
      where: {
        locationId_serviceDate: {
          locationId: params.locationId,
          serviceDate,
        },
      },
    });
    if (!meal) {
      throw new Error("Hoy no hay comida de empleado.");
    }

    const existing = await prisma.employeeMealOrder.findUnique({
      where: { mealId_userId: { mealId: meal.id, userId: params.userId } },
    });
    if (existing) {
      throw new Error("Ya pediste tu comida de hoy.");
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const lastTicket = await tx.order.findFirst({
          where: { locationId: params.locationId, ticketNumber: { not: null } },
          orderBy: { ticketNumber: "desc" },
          select: { ticketNumber: true },
        });
        const ticketNumber = (lastTicket?.ticketNumber ?? 0) + 1;
        const now = new Date();

        const order = await tx.order.create({
          data: {
            locationId: params.locationId,
            tableId: null,
            guestName: params.employeeName,
            waiterId: params.userId,
            status: "SENT_TO_KITCHEN",
            ticketNumber,
            notes: "Comida de empleado",
            checks: {
              create: {
                name: "Comida de empleado",
                status: "CLOSED",
                closedAt: now,
                subtotal: 0,
                total: 0,
                items: {
                  create: {
                    menuItemId: null,
                    nameSnapshot: meal.name,
                    unitPrice: 0,
                    quantity: 1,
                    lineTotal: 0,
                    status: "SENT_TO_KITCHEN",
                    sentToKitchenAt: now,
                    notes: meal.notes,
                  },
                },
              },
            },
          },
        });

        await tx.employeeMealOrder.create({
          data: {
            mealId: meal.id,
            userId: params.userId,
            orderId: order.id,
          },
        });

        return order;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Ya pediste tu comida de hoy.");
      }
      throw error;
    }
  }
}

export const employeeMealService = new EmployeeMealService();
