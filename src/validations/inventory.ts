import { IngredientKind, UnitType, WasteReason } from "@prisma/client";
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

const kindEnum = z.enum([
  "RAW",
  "PREP",
  "FROZEN",
  "PACKAGED",
] as const satisfies readonly IngredientKind[]);

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
  kind: kindEnum.default("RAW"),
  baseUnit: unitEnum,
  packSize: z.coerce.number().int().positive().optional().nullable(),
  storageNote: z.string().max(200).optional().nullable(),
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
  kind: kindEnum.optional(),
  baseUnit: unitEnum.optional(),
  packSize: z.coerce.number().int().positive().optional().nullable(),
  storageNote: z.string().max(200).optional().nullable(),
  minimumStock: z.coerce.number().min(0).optional(),
  targetStock: z.coerce.number().min(0).optional().nullable(),
  averageCost: z.coerce.number().min(0).optional(),
  preferredSupplierId: z.string().optional().nullable().or(z.literal("")),
  active: z.boolean().optional(),
});

/** Bulk patch: only fields with apply* = true are written. */
export const bulkUpdateIngredientsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  applySupplier: z.boolean().default(false),
  preferredSupplierId: z.string().optional().nullable().or(z.literal("")),
  applyKind: z.boolean().default(false),
  kind: kindEnum.optional(),
  applyCategory: z.boolean().default(false),
  category: z.string().max(80).optional().nullable(),
  applyMinimum: z.boolean().default(false),
  minimumStock: z.coerce.number().min(0).optional(),
  applyTarget: z.boolean().default(false),
  targetStock: z.coerce.number().min(0).optional().nullable(),
  applyActive: z.boolean().default(false),
  active: z.boolean().optional(),
  applyStock: z.boolean().default(false),
  stockMode: z.enum(["delta", "absolute"]).optional(),
  stockQuantity: z.coerce.number().optional(),
  stockNotes: z.string().max(500).optional().nullable(),
});

export const deleteIngredientsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export const runProductionBatchSchema = z.object({
  locationId: z.string().min(1),
  outputIngredientId: z.string().min(1),
  quantityProduced: z.coerce.number().positive(),
  batchMultiplier: z.coerce.number().positive().default(1),
  notes: z.string().max(500).optional().nullable(),
});

export const savePrepRecipeSchema = z.object({
  locationId: z.string().min(1),
  outputIngredientId: z.string().min(1),
  outputQuantity: z.coerce.number().positive(),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(z.object({
    ingredientId: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unit: unitEnum,
  })).min(1),
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
