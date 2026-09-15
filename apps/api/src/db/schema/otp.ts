import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * One outstanding verification code. The code itself is never stored — only a
 * salted hash — so a database leak cannot be replayed.
 *
 * Challenges are bound to the member who asked for them, so a code can only be
 * redeemed by that account and we never text an arbitrary number.
 */
export const otpChallenge = pgTable(
  "otp_challenge",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    destination: text("destination").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Both rate-limit reads are "recent rows for this destination / this member".
    index("otp_destination_idx").on(t.destination, t.createdAt),
    index("otp_user_idx").on(t.userId, t.createdAt),
  ],
);
