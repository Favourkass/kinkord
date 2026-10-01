import { index, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Chat threads.
 *
 * A 1:1 DM is a conversation with `kind = 'dm'` and a canonical `dmKey` built
 * from the two member ids ("<smaller>:<larger>"). The UNIQUE constraint on that
 * column is the rule that a pair only ever has one thread — the application
 * never has to win a race to enforce it. `kind = 'group'` is reserved so groups
 * can ship later without a migration.
 */
export type ConversationKind = "dm" | "group";

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<ConversationKind>().notNull().default("dm"),
    dmKey: text("dm_key"),
    /** Who opened the thread; what the daily cap on new conversations counts. */
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    /**
     * Denormalised: the conversation list reads newest-activity-first without a
     * join on `message`. Updated inside `sendMessage`, the only write path.
     */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("conversation_dm_key_unique").on(t.dmKey),
    index("conversation_last_message_idx").on(t.lastMessageAt),
    index("conversation_created_by_idx").on(t.createdBy, t.createdAt),
  ],
);

export const conversationParticipant = pgTable(
  "conversation_participant",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    /** Read receipts: pointer to the newest message this member has opened. */
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    lastReadMessageId: uuid("last_read_message_id"),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    // "which conversations am I in" — the single read every list does.
    index("conversation_participant_user_idx").on(t.userId, t.conversationId),
  ],
);

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /**
     * Required by the API today. Nullable so attachment-only messages can
     * arrive later without a migration.
     */
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /** Soft delete — a reply in flight still has a row to point at. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("message_conversation_idx").on(t.conversationId, t.createdAt),
    // The per-sender rate limit reads "my messages in the last minute".
    index("message_sender_idx").on(t.senderId, t.createdAt),
  ],
);
