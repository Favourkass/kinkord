import { z } from "zod";
export const currencySchema = z.enum(["coin", "star", "crown"]);
const rate = z.number().int().min(1).max(10_000_000);
const pair = z
  .object({ buy: rate, redeem: rate })
  .refine((v) => v.redeem <= v.buy, "Redemption rate cannot exceed purchase rate.");
export const walletSettingsSchema = z.object({
  rates: z.object({ coin: pair, star: pair, crown: pair }),
  minimumKobo: z.number().int().min(100).max(1_000_000_000),
  enabled: z.boolean(),
});
export const walletBankSchema = z.object({
  bankName: z.string().trim().min(2).max(60),
  accountName: z.string().trim().min(2).max(100),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Account numbers are 10 digits."),
});
export const walletRequestSchema = z.object({
  currency: currencySchema,
  quantity: z.number().int().min(1).max(1_000_000),
  requestKey: z.string().uuid(),
});
export const walletGiftSchema = walletRequestSchema.extend({ postId: z.string().uuid() });
export const withdrawalSchema = walletRequestSchema.extend({ bankId: z.string().uuid() });
export const walletProofSchema = z.object({
  receiptKey: z.string().min(1).max(500),
  senderReference: z.string().trim().min(1).max(100),
  senderAccountName: z.string().trim().min(2).max(100),
});
export const walletDecisionSchema = z
  .object({
    action: z.enum(["verify", "approve", "reject", "paid"]),
    note: z.string().trim().max(300).optional(),
    bankReference: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === "reject" && (!v.note || v.note.length < 3))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Give a rejection reason.",
        path: ["note"],
      });
    if (v.bankReference && v.action !== "verify" && v.action !== "paid")
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A bank reference is only recorded when verifying a payment or marking a withdrawal paid.",
        path: ["bankReference"],
      });
    if ((v.action === "paid" || v.action === "verify") && !v.bankReference)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the bank transfer reference.",
        path: ["bankReference"],
      });
  });
export const walletQuerySchema = z.object({
  kind: z.enum(["purchase", "withdrawal"]).optional(),
  status: z.enum(["pending", "submitted", "verified", "approved", "paid", "rejected"]).optional(),
});
