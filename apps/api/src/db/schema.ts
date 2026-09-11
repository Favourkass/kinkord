import {
  pgTable, uuid, text, timestamp, integer, bigint, index, primaryKey, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  type: text('type').notNull().default('dm'),
  dmKey: text('dm_key').unique(),
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
});

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastReadMessageId: uuid('last_read_message_id'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.conversationId, t.userId] }),
    userIdx: index('cp_user_idx').on(t.userId),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').notNull().references(() => users.id),
    body: text('body'),
    clientId: text('client_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    convIdx: index('messages_conv_created_idx').on(t.conversationId, t.createdAt),
    senderClientUq: uniqueIndex('messages_sender_client_uidx')
      .on(t.senderId, t.clientId)
      .where(sql`"client_id" is not null`),
  }),
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
    uploaderId: uuid('uploader_id').notNull().references(() => users.id),
    key: text('key').notNull(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ messageIdx: index('attachments_message_idx').on(t.messageId) }),
);