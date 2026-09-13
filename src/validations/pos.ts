import { z } from "zod";

export const openTableSchema = z.object({
  tableId: z.string().min(1),
  checkName: z.string().max(80).optional(),
  partySize: z.coerce.number().int().min(1).max(40).default(2),
  notes: z.string().max(500).optional().nullable(),
  waiterId: z.string().optional().nullable(),
});

export const addCheckSchema = z.object({
  orderId: z.string().min(1),
  name: z.string().min(1).max(80),
});

export const renameCheckSchema = z.object({
  checkId: z.string().min(1),
  name: z.string().min(1).max(80),
});

export const addItemSchema = z.object({
  checkId: z.string().min(1),
  menuItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
  modifierOptionIds: z.array(z.string()).default([]),
  notes: z.string().max(300).optional().nullable(),
  seatId: z.string().optional().nullable(),
});

export const updateQtySchema = z.object({
  orderItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
});

export const itemIdSchema = z.object({
  orderItemId: z.string().min(1),
});

export const assignSeatSchema = z.object({
  orderItemId: z.string().min(1),
  seatId: z.string().nullable(),
});

export const renameSeatSchema = z.object({
  seatId: z.string().min(1),
  displayName: z.string().max(80).optional().nullable(),
});

export const addSeatSchema = z.object({
  orderId: z.string().min(1),
});

export const sendKitchenSchema = z.object({
  checkId: z.string().min(1),
});

export const kitchenStatusSchema = z.object({
  orderItemId: z.string().min(1),
  status: z.enum(["PREPARING", "READY", "DELIVERED", "CANCELLED"]),
});

export const moveItemsSchema = z.object({
  orderItemIds: z.array(z.string()).min(1),
  targetCheckId: z.string().min(1),
});

export const splitEqualSchema = z.object({
  orderId: z.string().min(1),
  parts: z.coerce.number().int().min(2).max(20),
});

export const splitCustomSchema = z.object({
  orderId: z.string().min(1),
  amounts: z.array(z.coerce.number().positive()).min(2),
});

export const splitBySeatsSchema = z.object({
  orderId: z.string().min(1),
});

export const tableStatusSchema = z.object({
  tableId: z.string().min(1),
  status: z.enum([
    "AVAILABLE",
    "OCCUPIED",
    "RESERVED",
    "CLEANING",
    "AWAITING_PAYMENT",
  ]),
});

export const endSessionSchema = z.object({
  orderId: z.string().min(1),
  forceCleaning: z.boolean().optional(),
});
