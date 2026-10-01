import { z } from "zod";

/** Room for a long paste, but not a novel — matches the feel of a chat window. */
export const MESSAGE_BODY_MAX = 4000;
export const HISTORY_PAGE = 50;

export const startDmSchema = z.object({
  userId: z.string().trim().min(1).max(64),
});

/**
 * Text only for now. Attachments need an upload route that proves who uploaded
 * a file; until one exists, accepting file keys here would let anyone ask the
 * server to sign a download link for somebody else's photo.
 */
export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(MESSAGE_BODY_MAX),
  /** Echoed back so the sender's optimistic bubble can be matched to the saved row. */
  clientId: z.string().min(1).max(64).optional(),
});

export const markReadSchema = z.object({
  messageId: z.string().uuid(),
});

export const historyQuerySchema = z
  .object({
    /** Messages older than this one: scrolling back through the thread. */
    before: z.string().uuid().optional(),
    /** Messages newer than this one: what the open thread polls for. */
    after: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(HISTORY_PAGE),
  })
  .refine((q) => !(q.before && q.after), { message: "Use before or after, not both." });

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface ChatPeerDto {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
}

export interface ConversationSummaryDto {
  id: string;
  kind: "dm" | "group";
  lastMessageAt: string;
  /** Null when the other member has left Kinkord or been removed. */
  peer: ChatPeerDto | null;
  lastMessage: MessageDto | null;
  unreadCount: number;
}

/**
 * How many new chats (first messages to someone) the member may start today.
 * The super admins have no limit.
 */
export type ChatAllowanceDto =
  { newChatsPerDay: null } | { newChatsPerDay: number; usedToday: number; resetsAt: string };
