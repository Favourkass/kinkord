import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export type SignupRuleKind = "email" | "phone" | "ip" | "name";
export type SignupRuleAction = "block" | "flag";

/**
 * Identifiers a removed member may not come back with. Checked where accounts
 * are created and where verification codes are sent, so a blocked email or
 * phone can neither open a new account nor verify one.
 *
 * `block` refuses outright; `flag` lets the attempt through and alerts the
 * moderator. IPs should almost always be `flag`: Nigerian mobile networks put
 * thousands of subscribers behind one address, so blocking it shuts strangers
 * out while the target toggles airplane mode and gets a new one.
 *
 * A `name` rule is a fragment (a rare surname, say) matched against the sign-up
 * name and the email's local part, so near-miss emails surface without anyone
 * having to predict them.
 */
export const signupBlock = pgTable(
  "signup_block",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<SignupRuleKind>().notNull(),
    value: text("value").notNull(),
    action: text("action").$type<SignupRuleAction>().notNull().default("block"),
    reason: text("reason"),
    /**
     * The member a rule was written for, so lifting their block lifts these
     * rules too. Plain text rather than a foreign key: the rules have to
     * outlive the account they were written about.
     */
    subjectUserId: text("subject_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("signup_block_kind_value_unique").on(t.kind, t.value)],
);

export type StaffRole = "admin";

/** Who may use the admin tools. No row means an ordinary member. */
export const staff = pgTable("staff", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").$type<StaffRole>().notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * A suspended account. This row is what refuses new sessions; the member's
 * existing sessions are deleted when the ban is made. It lives beside the user
 * row rather than on it so lifting a ban is one delete, and Better Auth's own
 * table stays exactly as it ships.
 */
export const memberBan = pgTable("member_ban", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: text("reason"),
  bannedBy: text("banned_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Every admin action. The ids are plain text, not foreign keys, because the
 * record has to survive the account it describes being deleted.
 */
export const moderationLog = pgTable(
  "moderation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    subjectUserId: text("subject_user_id"),
    subjectPostId: uuid("subject_post_id"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("moderation_log_created_idx").on(t.createdAt)],
);
