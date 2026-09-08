import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Social graph: `followerId` follows `followingId`.
 *
 * "Friends" is not a separate model — two members are friends when they follow
 * each other (mutual follows), and "mutual friends" are the friends two members
 * have in common. One table keeps Follow the single social action everywhere.
 */
export const follow = pgTable(
  "follow",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    // Followers-of-X lookups (counts, "who follows me") scan by followingId.
    index("follow_following_idx").on(t.followingId),
  ],
);
