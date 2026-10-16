import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** One unordered pair: a pending request, or an explicitly accepted friendship. */
export const friendship = pgTable(
  "friendship",
  {
    userA: text("user_a")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userB: text("user_b")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    id: uuid("id").defaultRandom().notNull(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<"pending" | "accepted">().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userA, t.userB] }),
    uniqueIndex("friendship_id_idx").on(t.id),
    index("friendship_user_b_status_idx").on(t.userB, t.status),
    check("friendship_ordered_pair", sql`${t.userA} collate "C" < ${t.userB} collate "C"`),
    check("friendship_requester_in_pair", sql`${t.requesterId} in (${t.userA}, ${t.userB})`),
    check("friendship_valid_status", sql`${t.status} in ('pending', 'accepted')`),
  ],
);
