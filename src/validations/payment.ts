import { z } from "zod";

export const paymentLineSchema = z.object({
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  amount: z.coerce.number().min(0),
  tipAmount: z.coerce.number().min(0).default(0),
  reference: z.string().max(120).optional().nullable(),
});

export const closeCheckSchema = z.object({
  checkId: z.string().min(1),
  payments: z.array(paymentLineSchema).min(1),
});

export const dailyCloseSchema = z.object({
  businessDate: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
});
