import { UnitType, Weekday } from "@prisma/client";
import { z } from "zod";

const unitEnum = z.enum([
  "KG",
  "G",
  "L",
  "ML",
  "UNIT",
  "BOX",
  "PACK",
] as const satisfies readonly UnitType[]);

const weekdayEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const satisfies readonly Weekday[]);

export const createSupplierSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(2).max(120),
  contact: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().max(1000).optional().nullable(),
  active: z.boolean().default(true),
});

export const updateSupplierSchema = createSupplierSchema
  .omit({ locationId: true })
  .partial()
  .extend({ id: z.string().min(1) });

export const saveSchedulesSchema = z.object({
  supplierId: z.string().min(1),
  schedules: z.array(
    z.object({
      orderDay: weekdayEnum,
      deliveryDay: weekdayEnum,
    }),
  ),
});

export const saveSupplierProductSchema = z.object({
  supplierId: z.string().min(1),
  ingredientId: z.string().min(1),
  supplierSku: z.string().max(80).optional().nullable(),
  unit: unitEnum,
  unitCost: z.coerce.number().min(0),
  minOrderQty: z.coerce.number().min(0).optional().nullable(),
  active: z.boolean().default(true),
});

export const removeSupplierProductSchema = z.object({
  id: z.string().min(1),
});

export const poLineSchema = z.object({
  ingredientId: z.string().min(1),
  quantityOrdered: z.coerce.number().positive(),
  unit: unitEnum,
  expectedUnitCost: z.coerce.number().min(0),
});

export const createPurchaseOrderSchema = z.object({
  locationId: z.string().min(1),
  supplierId: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(poLineSchema).min(1),
});

export const replacePoItemsSchema = z.object({
  poId: z.string().min(1),
  items: z.array(poLineSchema).min(1),
});

export const setPoStatusSchema = z.object({
  poId: z.string().min(1),
  status: z.enum(["PENDING", "ORDERED", "CANCELLED"]),
});

export const receivePoSchema = z.object({
  poId: z.string().min(1),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantityReceived: z.coerce.number().min(0),
        actualUnitCost: z.coerce.number().min(0).optional().nullable(),
      }),
    )
    .min(1),
});

export const createSuggestedPosSchema = z.object({
  locationId: z.string().min(1),
});
