import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
export type WalletCurrency = "coin" | "star" | "crown";
export type WalletStatus = "pending" | "submitted" | "verified" | "approved" | "paid" | "rejected";
export interface WalletRates {
  coin: { buy: number; redeem: number };
  star: { buy: number; redeem: number };
  crown: { buy: number; redeem: number };
}
export const walletSettings = pgTable("wallet_settings", {
  id: integer("id").primaryKey(),
  rates: jsonb("rates").$type<WalletRates>().notNull(),
  minimumKobo: integer("minimum_kobo").notNull(),
  enabled: integer("enabled").notNull().default(0),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const walletBalance = pgTable(
  "wallet_balance",
  {
    userId: text("user_id").notNull(),
    currency: text("currency").$type<WalletCurrency>().notNull(),
    available: integer("available").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    /**
     * The part of `available` received as gifts: the only coins that can be
     * withdrawn. Bought coins are for spending, so they're spent first.
     */
    earned: integer("earned").notNull().default(0),
  },
  (t) => [
    uniqueIndex("wallet_balance_member_currency_idx").on(t.userId, t.currency),
    check("wallet_balance_nonnegative", sql`${t.available} >= 0 and ${t.reserved} >= 0`),
    check("wallet_balance_earned", sql`${t.earned} >= 0 and ${t.earned} <= ${t.available}`),
  ],
);
export const walletBank = pgTable(
  "wallet_bank",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    isDefault: integer("is_default").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("wallet_bank_user_idx").on(t.userId),
    uniqueIndex("wallet_bank_default_idx")
      .on(t.userId)
      .where(sql`${t.isDefault} = 1`),
  ],
);
export const walletOperation = pgTable(
  "wallet_operation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<"purchase" | "withdrawal">().notNull(),
    currency: text("currency").$type<WalletCurrency>().notNull(),
    quantity: integer("quantity").notNull(),
    amountKobo: integer("amount_kobo").notNull(),
    status: text("status").$type<WalletStatus>().notNull().default("pending"),
    reference: text("reference").notNull(),
    requestKey: uuid("request_key").notNull(),
    /**
     * The saved account a withdrawal was made to (its details are copied below): what a retry
     * is checked against, even after that account is removed. Null for a purchase.
     */
    bankId: uuid("bank_id"),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    receiptKey: text("receipt_key"),
    senderReference: text("sender_reference"),
    senderAccountName: text("sender_account_name"),
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by"),
    settlementReference: text("settlement_reference"),
    paidBy: text("paid_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("wallet_operation_request_idx").on(t.userId, t.requestKey),
    uniqueIndex("wallet_operation_reference_idx").on(t.reference),
    uniqueIndex("wallet_settlement_reference_idx")
      .on(t.kind, t.settlementReference)
      .where(sql`${t.settlementReference} is not null`),
    index("wallet_operation_queue_idx").on(t.kind, t.status, t.createdAt),
    index("wallet_operation_member_idx").on(t.userId, t.createdAt),
    check("wallet_operation_positive", sql`${t.quantity} > 0 and ${t.amountKobo} > 0`),
  ],
);
export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => walletOperation.id),
    userId: text("user_id").notNull(),
    currency: text("currency").$type<WalletCurrency>().notNull(),
    phase: text("phase").$type<"credit" | "hold" | "release" | "paid">().notNull(),
    availableDelta: integer("available_delta").notNull(),
    reservedDelta: integer("reserved_delta").notNull(),
    /** The change to the withdrawable (gift-earned) coins. */
    earnedDelta: integer("earned_delta").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("wallet_ledger_operation_phase_idx").on(t.operationId, t.phase),
    index("wallet_ledger_member_idx").on(t.userId, t.createdAt),
  ],
);

/** Immutable, balanced transfer: quantity leaves sender and enters recipient in one transaction. */
export const walletGift = pgTable(
  "wallet_gift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: text("sender_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    postId: uuid("post_id").notNull(),
    currency: text("currency").$type<WalletCurrency>().notNull(),
    quantity: integer("quantity").notNull(),
    /** How much of the gift came out of the sender's gift earnings (bought coins go first). */
    senderEarned: integer("sender_earned").notNull().default(0),
    requestKey: uuid("request_key").notNull(),
    senderName: text("sender_name").notNull(),
    recipientName: text("recipient_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("wallet_gift_request_idx").on(t.senderId, t.requestKey),
    index("wallet_gift_sender_idx").on(t.senderId, t.createdAt),
    index("wallet_gift_recipient_idx").on(t.recipientId, t.createdAt),
    // Every page of posts counts its gifts by post.
    index("wallet_gift_post_idx").on(t.postId),
    check("wallet_gift_positive", sql`${t.quantity} > 0 and ${t.quantity} <= 1000000`),
    check("wallet_gift_different_members", sql`${t.senderId} <> ${t.recipientId}`),
    check("wallet_gift_currency", sql`${t.currency} in ('coin', 'star', 'crown')`),
  ],
);
