import { z } from "zod";

export const createTransactionSchema = z.object({
  date: z.string().or(z.date()),
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().positive("Amount must be greater than zero"),
  type: z.enum(["EXPENSE", "INCOME"]),
  categoryId: z.string().optional().nullable(),
  accountId: z.string().min(1, "Account ID is required"),
  paymentMethod: z.string().optional(),
  source: z.enum(["MANUAL", "IMPORT", "RECURRING"]).optional(),
  referenceId: z.string().optional().nullable(),
  notes: z.string().optional()
});

export const updateTransactionSchema = z.object({
  date: z.string().or(z.date()).optional(),
  description: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  type: z.enum(["EXPENSE", "INCOME"]).optional(),
  categoryId: z.string().optional().nullable(),
  accountId: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceId: z.string().optional().nullable(),
  notes: z.string().optional(),
  reason: z.string().optional()
});
