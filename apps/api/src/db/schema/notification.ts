import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export type NotificationType =
  | "message"
  | "follow"
  | "comment"
  | "mention"
  | "like"
  | "repost"
  | "report"
  | "test"
  // A member's payment proof, for the admins to check.
  | "payment"
  // The member's own payment: confirmed, or not.
  | "payment_verified"
  | "payment_rejected"
  // A Silver member changed their name or photo, for the admins to look at.
  | "verification"
  | "silver_check";

/**
 * Member inbox, independent of whether any device has enabled browser push.
 * Rows record who did what to what; names, photos and links are read when the
 * inbox loads, so a renamed, re-photographed or removed member never shows
 * stale.
 */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationType>().notNull(),
    /** Who did it; null for Kinkord's own (reports, the push test). */
    actorId: text("actor_id").references(() => user.id, { onDelete: "cascade" }),
    /** What it's about: the post, or the conversation for a message. */
    subjectId: text("subject_id"),
    /**
     * One row per thing worth telling: a repeat (a re-like, a re-follow) or
     * another message in the same chat lands on the existing row. Null when
     * every event counts (each comment, each report).
     */
    dedupeKey: text("dedupe_key"),
    /** Messages in a chat since its row was last read; 1 otherwise. */
    count: integer("count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    readAt: timestamp("read_at", { withTimezone: true, precision: 3 }),
  },
  (t) => [
    index("notification_user_created_idx").on(t.userId, t.createdAt, t.id),
    index("notification_user_read_idx").on(t.userId, t.readAt),
    // Nulls are distinct here, so rows without a key never collide.
    uniqueIndex("notification_user_dedupe_idx").on(t.userId, t.dedupeKey),
    // Deleting a member clears what they did from everyone's inbox.
    index("notification_actor_idx").on(t.actorId),
  ],
);
