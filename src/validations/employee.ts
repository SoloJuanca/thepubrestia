import { z } from "zod";

const roleCodeSchema = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "WAITER",
  "CASHIER",
  "KITCHEN",
  "INVENTORY",
]);

const weekdaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const compensationTypeSchema = z.enum([
  "MONTHLY",
  "BIWEEKLY",
  "WEEKLY",
  "HOURLY",
]);

export const scheduleDaySchema = z.object({
  weekday: weekdaySchema,
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  isDayOff: z.boolean().default(false),
});

export const createEmployeeSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  roleCode: roleCodeSchema,
  locationId: z.string().min(1),
  jobTitle: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  schedule: z.array(scheduleDaySchema).optional(),
  compensation: z
    .object({
      type: compensationTypeSchema,
      amount: z.coerce.number().min(0),
      bonuses: z.coerce.number().min(0).optional(),
      tipsNotes: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .optional(),
});

export const updateEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  roleCode: roleCodeSchema.optional(),
  active: z.boolean().optional(),
  jobTitle: z.string().optional().nullable(),
});

export const upsertScheduleSchema = z.object({
  employeeProfileId: z.string().min(1),
  days: z.array(scheduleDaySchema).min(1),
});

export const upsertCompensationSchema = z.object({
  employeeProfileId: z.string().min(1),
  type: compensationTypeSchema,
  amount: z.coerce.number().min(0),
  bonuses: z.coerce.number().min(0).optional(),
  tipsNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
