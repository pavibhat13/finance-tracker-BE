import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(60),
  type: z.enum(["INCOME", "EXPENSE"]),
  parentCategoryId: z.string().optional().nullable(),
  color: z.string().optional(),
  icon: z.string().optional()
});
