import { z } from "zod";
import type { BillingPeriod, PaymentStatus, SilverCheckHold, SubscriptionPlan } from "../db/schema";

/** ₦1 to ₦10m, in kobo: anything outside is a typo, not a payment. */
const kobo = z.number().int().min(100).max(1_000_000_000);
/** Nigerian account numbers (NUBAN) are ten digits. */
const accountNumber = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Account numbers are 10 digits.");

export const checkoutSchema = z.object({ period: z.enum(["monthly", "yearly"]) });

export const receiptUploadSchema = z.object({
  contentType: z.string(),
  contentLength: z.number().int().positive().optional(),
});

/** What the member says they sent. The reference and amount start as ours but can change. */
export const submitPaymentSchema = z.object({
  reference: z.string().trim().min(1, "Enter the payment reference.").max(40),
  amountKobo: kobo,
  senderBankName: z.string().trim().min(2, "Enter the bank you paid from.").max(60),
  senderAccountName: z.string().trim().min(2, "Enter the name on the account.").max(100),
  senderAccountNumber: accountNumber,
  receiptKey: z.string().trim().min(1, "Upload your receipt.").max(500),
});

export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;

export const ADMIN_PAYMENT_STATUSES = [
  "submitted",
  "verified",
  "rejected",
  "pending",
  "expired",
] as const satisfies readonly PaymentStatus[];

export const adminPaymentsQuerySchema = z.object({
  status: z.enum(ADMIN_PAYMENT_STATUSES).default("submitted"),
  /** The sender's account name, a reference, an account number or the member. */
  q: z.string().trim().max(100).optional(),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().trim().min(3, "Say why, so the member knows what to fix.").max(300),
});

export const paymentSettingsSchema = z.object({
  bankName: z.string().trim().min(2).max(60),
  accountName: z.string().trim().min(2).max(100),
  accountNumber,
  monthlyKobo: kobo,
  yearlyKobo: kobo,
  monthlyUsdCents: z.number().int().min(1).max(10_000_000),
  yearlyUsdCents: z.number().int().min(1).max(10_000_000),
});

export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;

export type PlanPrices = Record<BillingPeriod, { kobo: number; usdCents: number }>;

export interface BankAccountDto {
  name: string;
  accountName: string;
  accountNumber: string;
}

/** What the member sent, as they told us. */
export interface PaymentProofDto {
  reference: string;
  amountKobo: number;
  senderBankName: string;
  senderAccountName: string;
  senderAccountNumber: string;
}

export interface PaymentDto {
  id: string;
  plan: SubscriptionPlan;
  period: BillingPeriod;
  /** A pending payment past its proof deadline reads as expired. */
  status: PaymentStatus;
  reference: string;
  amountKobo: number;
  usdCents: number;
  bank: BankAccountDto;
  expiresAt: string;
  /** Proof is taken until then, past the countdown for a slow transfer. */
  proofUntil: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** Why it was rejected. */
  reviewNote: string | null;
  proof: PaymentProofDto | null;
  createdAt: string;
}

/** The member's own Silver check: why it isn't showing, when it isn't. */
export interface SilverCheckDto {
  shown: boolean;
  reason: "held" | "new_account" | "photos" | null;
  heldFor: SilverCheckHold | null;
  showsFrom: string | null;
}

export interface SubscriptionStatusDto {
  plan: "basic" | SubscriptionPlan;
  /** When Silver runs out; null on Basic. */
  silverUntil: string | null;
  /** Null on Basic. */
  check: SilverCheckDto | null;
  /** Silver that never runs out (the founders'): nothing to pay, so no payments shown. */
  forGood: boolean;
  /** Checkout stays closed until there's an account to pay into. */
  available: boolean;
  prices: PlanPrices;
  /** The payment still in play: being paid, or waiting for an admin. */
  open: PaymentDto | null;
  /** The latest payment, when it was rejected and nothing has replaced it. */
  rejected: PaymentDto | null;
}

export interface PaymentMemberDto {
  userId: string;
  username: string | null;
  displayName: string;
}

export interface AdminPaymentDto extends PaymentDto {
  /** Null once the account is gone; the payment stays. */
  member: PaymentMemberDto | null;
  receipt: { url: string } | null;
}

export interface PaymentSettingsDto {
  bank: BankAccountDto | null;
  prices: PlanPrices;
  /** Only the founders may change where members' money goes. */
  canEdit: boolean;
  updatedAt: string | null;
}
