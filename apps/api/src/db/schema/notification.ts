import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export type NotificationType =
  "message" | "follow" | "comment" | "mention" | "like" | "repost" | "report" | "test";

/** Member inbox, independent of whether any device has enabled browser push. */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationType>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url").notNull(),
    actor: jsonb("actor").$type<{ name: string; avatarKey: string | null }>(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    readAt: timestamp("read_at", { withTimezone: true, precision: 3 }),
  },
  (t) => [
    index("notification_user_created_idx").on(t.userId, t.createdAt, t.id),
    index("notification_user_read_idx").on(t.userId, t.readAt),
  ],
);
