import { z } from "zod";

/** Room for a long paste, but not a novel — matches the feel of a chat window. */
export const MESSAGE_BODY_MAX = 4000;
export const HISTORY_PAGE = 50;

export const startDmSchema = z.object({
  userId: z.string().trim().min(1).max(64),
});

/**
 * Text, a photo, or both (the text is then its caption). The photo is named by
 * the key its upload slot returned; the service only accepts a key under the
 * sender's own prefix for this thread, so nobody can attach (and so get a
 * download link for) a photo somebody else uploaded.
 */
export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(MESSAGE_BODY_MAX).default(""),
    photoKey: z.string().trim().min(1).max(500).optional(),
    /** Echoed back so the sender's optimistic bubble can be matched to the saved row. */
    clientId: z.string().min(1).max(64).optional(),
  })
  .refine((v) => v.body.length > 0 || v.photoKey !== undefined, {
    message: "Write a message first.",
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Asking for a slot to upload one chat photo into, before sending it. */
export const photoUploadSchema = z.object({
  contentType: z.string().trim().min(1).max(100),
  contentLength: z.number().int().positive().optional(),
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

/** Short-lived links to one chat photo, in the sizes the thread shows. */
export interface ChatPhotoDto {
  /** The 160px copy: what a blurred, not-yet-opened photo shows. */
  previewUrl: string;
  /** The 480px copy: the photo in its bubble. */
  thumbUrl: string;
  /** The full photo, for viewing on its own. */
  url: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  /** Empty for a photo sent without a caption. */
  body: string;
  photo: ChatPhotoDto | null;
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

/** One open thread's header: the summary, plus what the composer may offer. */
export interface ConversationThreadDto extends ConversationSummaryDto {
  /** Photos unlock once the other member has written in this thread. */
  canSendPhotos: boolean;
}

/**
 * How many new chats (first messages to someone) the member may start today.
 * The super admins have no limit.
 */
export type ChatAllowanceDto =
  { newChatsPerDay: null } | { newChatsPerDay: number; usedToday: number; resetsAt: string };
