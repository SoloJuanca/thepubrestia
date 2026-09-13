import { z } from "zod";

const optionalUrl = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .nullable();

export const createCategorySchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(2, "Nombre requerido").max(80),
  description: z.string().max(500).optional().nullable(),
  imageUrl: optionalUrl,
  imagePath: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1).optional(),
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
  imageUrl: optionalUrl,
  imagePath: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const modifierOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  priceDelta: z.coerce.number().min(0).default(0),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const modifierGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  required: z.boolean().default(false),
  minSelections: z.coerce.number().int().min(0).default(0),
  maxSelections: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().min(0).default(0),
  options: z.array(modifierOptionSchema).min(1, "Agrega al menos una opción"),
});

export const createMenuItemSchema = z.object({
  locationId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  sku: z.union([z.string().max(40), z.literal(""), z.null()]).optional(),
  price: z.coerce.number().min(0),
  estimatedCost: z.coerce.number().min(0).optional().nullable(),
  taxRate: z.coerce.number().min(0).max(1).default(0.16),
  imageUrl: optionalUrl,
  imagePath: z.string().optional().nullable(),
  available: z.boolean().default(true),
  requiresPrep: z.boolean().default(true),
  estimatedPrepMins: z.coerce.number().int().min(0).optional().nullable(),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  modifierGroups: z.array(modifierGroupSchema).default([]),
});

export const updateMenuItemSchema = createMenuItemSchema
  .partial()
  .extend({ id: z.string().min(1) });

export const toggleMenuItemSchema = z.object({
  id: z.string().min(1),
  available: z.boolean().optional(),
  active: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
