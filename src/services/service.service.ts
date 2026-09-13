import type { Prisma, ServiceRecurrence, ServiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/services/pricing.service";

type Tx = Prisma.TransactionClient | typeof prisma;

function emptyToNull(v?: string | null) {
  if (v == null || v === "") return null;
  return v;
}

export function computeNextDate(
  from: Date,
  recurrenceType: ServiceRecurrence,
  interval = 1,
): Date {
  const n = Math.max(1, interval);
  const next = new Date(from.getTime());

  switch (recurrenceType) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * n);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14 * n);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1 * n);
      break;
    case "BIMONTHLY":
      next.setMonth(next.getMonth() + 2 * n);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3 * n);
      break;
    case "SEMIANNUAL":
      next.setMonth(next.getMonth() + 6 * n);
      break;
    case "ANNUAL":
      next.setFullYear(next.getFullYear() + 1 * n);
      break;
    case "CUSTOM":
      next.setDate(next.getDate() + n);
      break;
    default:
      next.setMonth(next.getMonth() + n);
  }

  return next;
}

export class ServiceOpsService {
  async list(locationId: string, opts?: { status?: ServiceStatus }) {
    return prisma.service.findMany({
      where: {
        locationId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      include: {
        supplier: true,
        logs: { orderBy: { performedAt: "desc" }, take: 5 },
      },
      orderBy: [{ nextServiceDate: "asc" }, { name: "asc" }],
    });
  }

  async getById(id: string) {
    return prisma.service.findUnique({
      where: { id },
      include: {
        supplier: true,
        logs: { orderBy: { performedAt: "desc" }, take: 20 },
      },
    });
  }

  async create(params: {
    locationId: string;
    name: string;
    description?: string | null;
    category?: string | null;
    supplierId?: string | null;
    expectedCost?: number;
    recurrenceType?: ServiceRecurrence;
    recurrenceInterval?: number;
    nextServiceDate?: Date | null;
    reminderDaysBefore?: number;
    notes?: string | null;
  }) {
    const recurrenceType = params.recurrenceType ?? "MONTHLY";
    const recurrenceInterval = params.recurrenceInterval ?? 1;
    const nextServiceDate =
      params.nextServiceDate ??
      computeNextDate(new Date(), recurrenceType, recurrenceInterval);

    return prisma.service.create({
      data: {
        locationId: params.locationId,
        name: params.name.trim(),
        description: emptyToNull(params.description),
        category: emptyToNull(params.category),
        supplierId: emptyToNull(params.supplierId),
        expectedCost: roundMoney(params.expectedCost ?? 0),
        recurrenceType,
        recurrenceInterval,
        nextServiceDate,
        reminderDaysBefore: params.reminderDaysBefore ?? 7,
        notes: emptyToNull(params.notes),
        status: "ACTIVE",
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      category?: string | null;
      supplierId?: string | null;
      expectedCost?: number;
      recurrenceType?: ServiceRecurrence;
      recurrenceInterval?: number;
      nextServiceDate?: Date | null;
      lastServiceDate?: Date | null;
      reminderDaysBefore?: number;
      status?: ServiceStatus;
      notes?: string | null;
    },
  ) {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) throw new Error("Servicio no encontrado.");

    return prisma.service.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        description:
          data.description === undefined
            ? undefined
            : emptyToNull(data.description),
        category:
          data.category === undefined ? undefined : emptyToNull(data.category),
        supplierId:
          data.supplierId === undefined
            ? undefined
            : emptyToNull(data.supplierId),
        expectedCost:
          data.expectedCost === undefined
            ? undefined
            : roundMoney(data.expectedCost),
        recurrenceType: data.recurrenceType,
        recurrenceInterval: data.recurrenceInterval,
        nextServiceDate: data.nextServiceDate,
        lastServiceDate: data.lastServiceDate,
        reminderDaysBefore: data.reminderDaysBefore,
        status: data.status,
        notes: data.notes === undefined ? undefined : emptyToNull(data.notes),
      },
    });
  }

  async archive(id: string) {
    return this.update(id, { status: "ARCHIVED" });
  }

  async completeService(params: {
    serviceId: string;
    performedAt: Date;
    actualCost: number;
    notes?: string | null;
    employeeUserId?: string | null;
  }) {
    const service = await prisma.service.findUnique({
      where: { id: params.serviceId },
      include: { supplier: true },
    });
    if (!service) throw new Error("Servicio no encontrado.");
    if (service.status === "ARCHIVED") {
      throw new Error("El servicio está archivado.");
    }

    const actualCost = roundMoney(params.actualCost);
    const expectedCost = Number(service.expectedCost);
    const nextServiceDate = computeNextDate(
      params.performedAt,
      service.recurrenceType,
      service.recurrenceInterval,
    );

    return prisma.$transaction(async (tx: Tx) => {
      const expense = await tx.expense.create({
        data: {
          locationId: service.locationId,
          category: "Mantenimiento",
          concept: `Servicio: ${service.name}`,
          amount: actualCost,
          expenseDate: params.performedAt,
          supplierId: service.supplierId,
          recurrence: "NONE",
          notes: emptyToNull(params.notes),
        },
      });

      const log = await tx.serviceLog.create({
        data: {
          serviceId: service.id,
          performedAt: params.performedAt,
          expectedCost,
          actualCost,
          supplierName: service.supplier?.name ?? null,
          expenseId: expense.id,
          notes: emptyToNull(params.notes),
        },
      });

      const updated = await tx.service.update({
        where: { id: service.id },
        data: {
          lastServiceDate: params.performedAt,
          nextServiceDate,
        },
      });

      if (params.employeeUserId) {
        await tx.auditLog.create({
          data: {
            userId: params.employeeUserId,
            action: "SERVICE_COMPLETE",
            entity: "Service",
            entityId: service.id,
            after: {
              logId: log.id,
              expenseId: expense.id,
              actualCost,
              nextServiceDate: nextServiceDate.toISOString(),
            },
          },
        });
      }

      return { service: updated, log, expense };
    });
  }
}

export const serviceService = new ServiceOpsService();

/** Alias used by tests / UI helpers */
export const computeNextServiceDate = computeNextDate;
