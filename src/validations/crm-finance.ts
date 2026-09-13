import { PromotionType, ExpenseRecurrence, PayrollStatus } from "@prisma/client";
import { z } from "zod";

export const upsertCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
});

export const updateCustomerSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
});

export const assignCustomerPromoSchema = z.object({
  customerId: z.string().min(1),
  promotionId: z.string().min(1),
  expiresAt: z.string().optional().nullable(),
});

export const attachCustomerToCheckSchema = z.object({
  checkId: z.string().min(1),
  customerId: z.string().min(1).nullable(),
});

const promoTypeEnum = z.enum([
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "FREE_PRODUCT",
  "SPECIAL_PRICE",
] as const satisfies readonly PromotionType[]);

export const createPromotionSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  code: z.string().min(2).max(40),
  type: promoTypeEnum,
  amount: z.coerce.number().min(0),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  active: z.boolean().default(true),
  totalLimit: z.coerce.number().int().positive().optional().nullable(),
  perCustomerLimit: z.coerce.number().int().positive().optional().nullable(),
  stackable: z.boolean().default(false),
  appliesToEntireCheck: z.boolean().default(false),
  menuItemIds: z.array(z.string()).default([]),
  categoryIds: z.array(z.string()).default([]),
});

export const updatePromotionSchema = createPromotionSchema
  .omit({ locationId: true })
  .partial()
  .extend({ id: z.string().min(1) });

export const applyPromoSchema = z.object({
  checkId: z.string().min(1),
  promotionId: z.string().min(1),
  customerPromotionId: z.string().optional().nullable(),
});

export const removePromoSchema = z.object({
  checkId: z.string().min(1),
});

export const submitReviewSchema = z.object({
  token: z.string().min(8),
  overallRating: z.coerce.number().int().min(1).max(5),
  foodRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  serviceRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  ambienceRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  guestName: z.string().max(120).optional().nullable(),
  guestEmail: z.string().email().optional().nullable().or(z.literal("")),
});

export const mintReviewTokenSchema = z.object({
  orderId: z.string().optional().nullable(),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(14),
});

const recurrenceEnum = z.enum([
  "NONE",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
] as const satisfies readonly ExpenseRecurrence[]);

export const createExpenseSchema = z.object({
  locationId: z.string().min(1),
  category: z.string().min(2).max(80),
  concept: z.string().min(2).max(200),
  amount: z.coerce.number().positive(),
  expenseDate: z.string().min(1),
  supplierId: z.string().optional().nullable(),
  recurrence: recurrenceEnum.default("NONE"),
  notes: z.string().max(1000).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export const updateExpenseSchema = createExpenseSchema
  .omit({ locationId: true })
  .partial()
  .extend({ id: z.string().min(1) });

export const deleteExpenseSchema = z.object({ id: z.string().min(1) });

const payrollStatusEnum = z.enum([
  "DRAFT",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const satisfies readonly PayrollStatus[]);

export const createPayrollSchema = z.object({
  locationId: z.string().min(1),
  employeeId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  baseSalary: z.coerce.number().min(0),
  hours: z.coerce.number().min(0).optional().nullable(),
  bonuses: z.coerce.number().min(0).default(0),
  deductions: z.coerce.number().min(0).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const setPayrollStatusSchema = z.object({
  id: z.string().min(1),
  status: payrollStatusEnum,
});
