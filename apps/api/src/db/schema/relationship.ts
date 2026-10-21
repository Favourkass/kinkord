import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** "ds": the submissive asks and the dominant accepts. "romantic": either side asks. */
export type RelationshipKind = "ds" | "romantic";

/**
 * Two members' profiles linked, FetLife-style: asked for by one, accepted by
 * the other, then shown on both. In a D/s link the submissive always asks, so
 * `requesterId` is the submissive and the other member the dominant. One link
 * of each kind per pair, whoever asked: the pair is ordered like a
 * friendship's so a request and its mirror can't both exist.
 */
export const memberRelationship = pgTable(
  "member_relationship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userA: text("user_a")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userB: text("user_b")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RelationshipKind>().notNull(),
    /** A key from RELATIONSHIP_TYPES: the dominant's role in a D/s link, else the relationship. */
    type: text("type").notNull(),
    status: text("status").$type<"pending" | "accepted">().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("member_relationship_pair_kind_idx").on(t.userA, t.userB, t.kind),
    index("member_relationship_user_b_idx").on(t.userB, t.status),
    check("member_relationship_ordered_pair", sql`${t.userA} collate "C" < ${t.userB} collate "C"`),
    check(
      "member_relationship_requester_in_pair",
      sql`${t.requesterId} in (${t.userA}, ${t.userB})`,
    ),
    check("member_relationship_valid_status", sql`${t.status} in ('pending', 'accepted')`),
    check("member_relationship_valid_kind", sql`${t.kind} in ('ds', 'romantic')`),
  ],
);
