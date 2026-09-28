import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("signup_block_kind_value_unique").on(t.kind, t.value)],
);
