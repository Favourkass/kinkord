import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * A member removed from someone's "Kinksters Near You" for good: `userId`
 * tapped Remove on `dismissedUserId`'s card, and won't be suggested them again.
 */
export const suggestionDismissal = pgTable(
  "suggestion_dismissal",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dismissedUserId: text("dismissed_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dismissedUserId] })],
);
