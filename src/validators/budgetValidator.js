import { z } from "zod";

export const upsertBudgetSchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  limit: z.number().nonnegative("Budget limit cannot be negative")
});
