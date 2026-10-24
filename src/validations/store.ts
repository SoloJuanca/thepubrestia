import { z } from "zod";

/** Only send customers back to their own pages. */
export function safeCustomerPath(value: string | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/pedir";
  }
  if (value.startsWith("/pedir") || value.startsWith("/cuenta/pedidos")) {
    return value;
  }
  return "/pedir";
}

export const customerLoginSchema = z.object({
  email: z.string().trim().email("Escribe un correo válido.").max(160),
  password: z.string().min(1, "Escribe tu contraseña.").max(200),
  callbackUrl: z.string().max(200).optional(),
});

export const customerRegisterSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80),
  email: z.string().trim().email("Escribe un correo válido.").max(160),
  phone: z.string().trim().max(30).optional(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(200),
});

export const webOrderLineSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  modifierOptionIds: z.array(z.string().min(1)).max(30),
  notes: z.string().trim().max(160).optional(),
});

export const placeWebOrderSchema = z.object({
  note: z.string().trim().max(240).optional(),
  lines: z.array(webOrderLineSchema).min(1, "Agrega al menos un producto.").max(40),
});
