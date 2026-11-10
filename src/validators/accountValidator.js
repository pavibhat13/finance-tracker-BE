import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(60),
  accountType: z.enum(["BANK", "CASH", "CREDIT_CARD", "WALLET"]),
  bankName: z.string().optional(),
  accountNumberMasked: z.string().optional(),
  openingBalance: z.number().optional().default(0)
});
