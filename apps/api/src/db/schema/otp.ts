import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const otpChallenge = pgTable("otp_challenge", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  destination: text("destination").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
