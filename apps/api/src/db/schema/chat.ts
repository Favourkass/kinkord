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
    /** Newest message acknowledged as received by this member's app; does not clear unread. */
    lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
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
    /** Optional when the message carries a photo, which then needs no caption. */
    body: text("body"),
    /**
     * The photo's S3 key, under `chat/<conversationId>/<senderId>/`: the prefix
     * is what proves the sender uploaded it, for this thread.
     */
    photoKey: text("photo_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** When the sender last changed its text. Earlier versions are kept in `message_edit`. */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /**
     * Deleted for everyone by its sender: both members see "deleted" in its
     * place. The text and photo stay, for the moderators, and never reach the app.
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /**
     * The message this one was forwarded from, shown as "Forwarded". A plain
     * id, not a foreign key: the copy stays when the original goes.
     */
    forwardedFromId: uuid("forwarded_from_id"),
  },
  (t) => [
    index("message_conversation_idx").on(t.conversationId, t.createdAt),
    // The per-sender rate limit reads "my messages in the last minute".
    index("message_sender_idx").on(t.senderId, t.createdAt),
  ],
);

/** Inbox attention is independent from conversation read receipts. */
export const chatInboxSeen = pgTable("chat_inbox_seen", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull(),
});

/**
 * "Delete for me": a message one member no longer sees. The other member
 * still does, and nothing is removed.
 */
export const messageHidden = pgTable(
  "message_hidden",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.messageId] })],
);

/**
 * A message's text before each edit, so a report shows the moderators what
 * was first said, not only what it was changed to.
 */
export const messageEdit = pgTable(
  "message_edit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    /** Who edited: always the sender. Here so the edit rate limit reads one index. */
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The text before this edit; null for a photo that had no caption. */
    body: text("body"),
    replacedAt: timestamp("replaced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("message_edit_message_idx").on(t.messageId, t.replacedAt),
    index("message_edit_sender_idx").on(t.senderId, t.replacedAt),
  ],
);
