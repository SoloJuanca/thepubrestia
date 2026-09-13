import { UnitType, WasteReason } from "@prisma/client";
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

const wasteReasonEnum = z.enum([
  "DAMAGED",
  "EXPIRED",
  "KITCHEN_ERROR",
  "COMP",
  "INTERNAL",
  "OTHER",
] as const satisfies readonly WasteReason[]);

export const createIngredientSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(2).max(120),
  category: z.string().max(80).optional().nullable(),
  baseUnit: unitEnum,
  currentStock: z.coerce.number().min(0).default(0),
  minimumStock: z.coerce.number().min(0).default(0),
  targetStock: z.coerce.number().min(0).optional().nullable(),
  averageCost: z.coerce.number().min(0).default(0),
  preferredSupplierId: z.string().optional().nullable().or(z.literal("")),
  active: z.boolean().default(true),
});

export const updateIngredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(120).optional(),
  category: z.string().max(80).optional().nullable(),
  baseUnit: unitEnum.optional(),
  minimumStock: z.coerce.number().min(0).optional(),
  targetStock: z.coerce.number().min(0).optional().nullable(),
  averageCost: z.coerce.number().min(0).optional(),
  preferredSupplierId: z.string().optional().nullable().or(z.literal("")),
  active: z.boolean().optional(),
});

export const adjustStockSchema = z.object({
  ingredientId: z.string().min(1),
  mode: z.enum(["delta", "absolute"]),
  quantity: z.coerce.number(),
  notes: z.string().max(500).optional().nullable(),
});

export const wasteSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  reason: wasteReasonEnum,
  comment: z.string().max(500).optional().nullable(),
});

export const recipeItemSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: unitEnum,
});

export const saveRecipeSchema = z.object({
  menuItemId: z.string().min(1),
  items: z.array(recipeItemSchema),
});

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;
