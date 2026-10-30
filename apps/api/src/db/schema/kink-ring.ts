import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { subscriptionPayment } from "./subscription";

/**
 * A Kink Ring: a month of Silver to give away (docs/KINK_RINGS.md). Silver
 * paid for a month brings one, for a year twelve; the Nth expires 30 × N days
 * after the payment is confirmed. Given, it puts the receiver on Silver for a
 * month. Unused, it simply expires.
 */
export const kinkRing = pgTable(
  "kink_ring",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The Silver payment it came with; null for rings the founders put in. */
    paymentId: uuid("payment_id").references(() => subscriptionPayment.id, {
      onDelete: "set null",
    }),
    /** Its place among the payment's rings, 1 to 12. */
    seq: integer("seq").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Who it was given to. Kept as given if they later leave, for the giver's history. */
    givenTo: text("given_to").references(() => user.id, { onDelete: "set null" }),
    /** Private note from the giver, displayed only to the recipient in their inbox. */
    giftMessage: text("gift_message"),
    givenAt: timestamp("given_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // A member's rings, soonest to expire first.
    index("kink_ring_owner_idx").on(t.ownerId, t.expiresAt),
    // A payment brings each of its rings once, however it's confirmed.
    uniqueIndex("kink_ring_payment_seq_idx").on(t.paymentId, t.seq),
  ],
);
