import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export type ProfileMediaKind = "avatar" | "cover";

/**
 * Every profile photo / cover a member has uploaded (Media tab → "Profile Photo" and
 * "Photos"; CEO brief 2026-09-12). Rows are appended when the profile points at a new
 * key and removed when the member deletes the photo from the tab. Post media lives with
 * posts.
 */
export const profileMedia = pgTable(
  "profile_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ProfileMediaKind>().notNull(),
    /** S3 object key (sizes derive via `variantKey`). */
    key: text("key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("profile_media_user_idx").on(t.userId, t.createdAt)],
);
