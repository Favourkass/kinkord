import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * One member blocking another: a member's own choice, unlike `member_ban`,
 * which is the moderators' suspension. A block in either direction stops the
 * pair messaging each other; to the blocked member, the blocker reads as gone.
 */
export const memberBlock = pgTable(
  "member_block",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    // "has anyone blocked me" reads by the blocked side.
    index("member_block_blocked_idx").on(t.blockedId),
  ],
);

/** Most serious first: the order the moderators' queue reads in. */
export type ReportReason =
  "underage" | "illegal" | "non_consensual" | "unwanted_sexual" | "harassment" | "spam" | "other";

export type ReportStatus = "open" | "resolved" | "dismissed";

/** A message as it stood when it was reported. */
export interface ReportEvidence {
  id: string;
  senderId: string;
  body: string | null;
  photoKey: string | null;
  createdAt: string;
}

/**
 * A member reporting another, from a chat. The ids are plain text, not foreign
 * keys, because a report has to outlive the accounts and the thread it's
 * about. `evidence` keeps the thread's last messages as they were when the
 * report was made, so what the moderators review can't change underneath them.
 */
export const report = pgTable(
  "report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: text("reporter_id").notNull(),
    reportedUserId: text("reported_user_id"),
    conversationId: uuid("conversation_id"),
    reason: text("reason").$type<ReportReason>().notNull(),
    details: text("details"),
    evidence: jsonb("evidence").$type<ReportEvidence[]>().notNull().default([]),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // The moderators' queue: open reports, newest first.
    index("report_status_created_idx").on(t.status, t.createdAt),
    // The daily cap reads "reports I've made today".
    index("report_reporter_created_idx").on(t.reporterId, t.createdAt),
    index("report_reported_user_idx").on(t.reportedUserId),
  ],
);
