import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * One row per browser or installed app that agreed to notifications. The
 * endpoint is the push service's address for that device. It is unique, so
 * a phone that switches accounts moves its one row to the new member and
 * never notifies two people.
 */
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    /** The device's keys for encrypting what we send it. */
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("push_subscription_user_idx").on(t.userId)],
);

/**
 * The VAPID key pair push services check our sends against. A single row,
 * made by the API the first time it's needed, so no person ever handles the
 * private key. Changing it would cut off every existing subscription.
 */
export const pushVapidKey = pgTable(
  "push_vapid_key",
  {
    id: smallint("id").primaryKey().default(1),
    publicKey: text("public_key").notNull(),
    privateKey: text("private_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [check("push_vapid_key_single_row", sql`${t.id} = 1`)],
);

/**
 * Which kinds of push the member has turned off in Settings → Notifications
 * (groups from push/push-policy.ts). The inbox keeps everything either way;
 * this only decides what reaches their devices.
 */
export const pushPreference = pgTable("push_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  off: jsonb("off").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Every push a member's devices were sent, by notification type. It spaces out
 * bundled pushes and caps how many go out in a day (push/push-policy.ts).
 */
export const pushSent = pgTable(
  "push_sent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_sent_user_idx").on(t.userId, t.sentAt)],
);
