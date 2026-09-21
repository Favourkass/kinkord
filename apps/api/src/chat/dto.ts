import { z } from "zod";

/** Room for a long paste, but not a novel — matches the feel of a chat window. */
export const MESSAGE_BODY_MAX = 4000;
/** A 2x2 grid is what the bubble renders well on a phone. */
export const MESSAGE_MEDIA_MAX = 4;

export const sendMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    body: z.string().trim().max(MESSAGE_BODY_MAX).nullish(),
    media: z
      .array(
        z.object({
          kind: z.enum(["image", "video", "file"]),
          key: z.string().min(1).max(512),
          posterKey: z.string().min(1).max(512).nullish(),
        }),
      )
      .max(MESSAGE_MEDIA_MAX)
      .default([]),
    /**
     * Client-generated id echoed back in the ack, so the sender's optimistic
     * row can be reconciled to the persisted one without re-fetching. It never
     * reaches the broadcast — other devices would see a duplicate.
     */
    clientId: z.string().min(1).max(64).optional(),
  })
  .refine((v) => Boolean(v.body?.length) || v.media.length > 0, {
    message: "A message needs text or at least one attachment.",
    path: ["body"],
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const markReadSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const typingSchema = z.object({
  conversationId: z.string().uuid(),
  isTyping: z.boolean(),
});

export const startDmSchema = z.object({
  userId: z.string().min(1),
});

export const historyQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const presenceQuerySchema = z.object({
  userIds: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1)).max(200)),
});

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  media: Array<{
    id: string;
    kind: string;
    key: string;
    posterKey: string | null;
    position: number;
  }>;
}

export interface ConversationSummaryDto {
  id: string;
  kind: "dm" | "group";
  lastMessageAt: string;
  participants: Array<{
    userId: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
  }>;
  lastMessage: MessageDto | null;
  unreadCount: number;
}
