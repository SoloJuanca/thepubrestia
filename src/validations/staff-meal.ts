import { z } from "zod";

export const setEmployeeMealSchema = z.object({
  name: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(240).optional().nullable(),
});
