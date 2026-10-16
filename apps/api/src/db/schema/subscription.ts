import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export type SubscriptionPlan = "silver";
export type BillingPeriod = "monthly" | "yearly";

/**
 * pending: checkout made, waiting for the member's transfer and proof.
 * submitted: proof sent, waiting for an admin. verified / rejected: decided.
 * expired: the window closed without proof, or the member started another.
 */
export type PaymentStatus = "pending" | "submitted" | "verified" | "rejected" | "expired";

/**
 * Where members send their money, and what Silver costs. One row (id 1),
 * changed by the founders on the admin screen. Until it exists, checkout stays
 * closed: there's no account to pay into.
 */
export const paymentSettings = pgTable("payment_settings", {
  id: integer("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  monthlyKobo: integer("monthly_kobo").notNull(),
  yearlyKobo: integer("yearly_kobo").notNull(),
  monthlyUsdCents: integer("monthly_usd_cents").notNull(),
  yearlyUsdCents: integer("yearly_usd_cents").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * One Silver purchase by bank transfer, from checkout to an admin's decision.
 * `amountKobo` is the price plus a few naira, unique among open payments, so a
 * line on the bank statement points at one member; the sender account name
 * the member gives is what the team tracks it by. The member id is plain text,
 * not a foreign key: a payment record has to outlive the account that made it.
 */
export const subscriptionPayment = pgTable(
  "subscription_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    plan: text("plan").$type<SubscriptionPlan>().notNull(),
    period: text("period").$type<BillingPeriod>().notNull(),
    /** KIN + the Lagos time of checkout, e.g. KIN20260924114238. */
    reference: text("reference").notNull(),
    amountKobo: integer("amount_kobo").notNull(),
    usdCents: integer("usd_cents").notNull(),
    // Where the member was told to pay, as it stood at checkout.
    bankName: text("bank_name").notNull(),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    status: text("status").$type<PaymentStatus>().notNull().default("pending"),
    /** The end of the countdown on the transfer screen. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // What the member says they sent, and from where.
    paidReference: text("paid_reference"),
    paidAmountKobo: integer("paid_amount_kobo"),
    senderBankName: text("sender_bank_name"),
    senderAccountName: text("sender_account_name"),
    senderAccountNumber: text("sender_account_number"),
    receiptKey: text("receipt_key"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Why it was rejected, as the member reads it. */
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("subscription_payment_reference_idx").on(t.reference),
    // An amount names one open payment, so a transfer can only be one member's.
    uniqueIndex("subscription_payment_open_amount_idx")
      .on(t.amountKobo)
      .where(sql`${t.status} in ('pending', 'submitted')`),
    index("subscription_payment_user_idx").on(t.userId, t.createdAt),
    // The admin queue: by status, the oldest proof first.
    index("subscription_payment_status_idx").on(t.status, t.submittedAt),
  ],
);

/** Why a Silver member's check is hidden until an admin looks again. */
export type SilverCheckHold = "name" | "username" | "photo" | "admin";

/** A member's paid plan, good until `currentPeriodEnd`. No row is Kinkord Basic. */
export const memberSubscription = pgTable("member_subscription", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: text("plan").$type<SubscriptionPlan>().notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  /** When this unbroken run of Silver began: "Silver since" on the profile. */
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  /**
   * Set when the member changes their name, username or photo (or an admin
   * takes the check away): the check stays hidden until an admin approves it,
   * so it can't be bought and then used to impersonate someone.
   */
  checkHeldAt: timestamp("check_held_at", { withTimezone: true }),
  checkHoldReason: text("check_hold_reason").$type<SilverCheckHold>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
