import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One wrong password, counted per account and per network over a short window
 * so nobody can keep guessing (auth/sign-in-limits.ts). Network keys are a keyed
 * hash of the address, so no address is kept in the clear.
 */
export const signInFailure = pgTable(
  "sign_in_failure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sign_in_failure_key_idx").on(t.key, t.createdAt)],
);
