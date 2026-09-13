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

export const createEmployeeSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  roleCode: roleCodeSchema,
  locationId: z.string().min(1),
});

export const updateEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  roleCode: roleCodeSchema.optional(),
  active: z.boolean().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
