import {
  AttendanceStatus,
  ServiceRecurrence,
  ServiceStatus,
} from "@prisma/client";
import { z } from "zod";

export const checkInSchema = z.object({
  employeeId: z.string().min(1),
  locationId: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
});

export const checkOutSchema = z.object({
  employeeId: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
});

export const listAttendanceSchema = z.object({
  locationId: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const attendanceStatusEnum = z.enum([
  "ON_TIME",
  "LATE",
  "EARLY_LEAVE",
  "COMPLETE",
  "OPEN",
  "ABSENT",
] as const satisfies readonly AttendanceStatus[]);

export const updateAttendanceStatusSchema = z.object({
  id: z.string().min(1),
  status: attendanceStatusEnum,
  notes: z.string().max(500).optional().nullable(),
});

const serviceRecurrenceEnum = z.enum([
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "CUSTOM",
] as const satisfies readonly ServiceRecurrence[]);

const serviceStatusEnum = z.enum([
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
] as const satisfies readonly ServiceStatus[]);

export const createServiceSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  expectedCost: z.coerce.number().min(0).default(0),
  recurrenceType: serviceRecurrenceEnum.default("MONTHLY"),
  recurrenceInterval: z.coerce.number().int().positive().default(1),
  nextServiceDate: z.string().optional().nullable(),
  reminderDaysBefore: z.coerce.number().int().min(0).max(90).default(7),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateServiceSchema = createServiceSchema
  .omit({ locationId: true })
  .partial()
  .extend({
    id: z.string().min(1),
    status: serviceStatusEnum.optional(),
    lastServiceDate: z.string().optional().nullable(),
  });

export const completeServiceSchema = z.object({
  serviceId: z.string().min(1),
  performedAt: z.string().min(1),
  actualCost: z.coerce.number().min(0),
  notes: z.string().max(1000).optional().nullable(),
  employeeUserId: z.string().min(1).optional().nullable(),
});

export const deleteServiceSchema = z.object({
  id: z.string().min(1),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CompleteServiceInput = z.infer<typeof completeServiceSchema>;
