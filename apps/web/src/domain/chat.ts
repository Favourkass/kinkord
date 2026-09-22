/** Mirrors the API's MessageDto. `key` is an S3 object key until presign lands. */
export interface ChatMessageMedia {
  id: string;
  kind: "image" | "video" | "file";
  key: string;
  posterKey: string | null;
  position: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  media: ChatMessageMedia[];
}

export interface ChatParticipant {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface ConversationSummary {
  id: string;
  kind: "dm" | "group";
  lastMessageAt: string;
  participants: ChatParticipant[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

/** One row in the messages list, already resolved for the viewer. */
export interface ConversationRowVM {
  id: string;
  href: string;
  displayName: string;
  avatarUrl: string | null;
  preview: string;
  time: string;
  unread: number;
  isOnline: boolean;
}

/**
 * One bubble in a thread. `clientId` is set on optimistic rows so an ack can
 * reconcile them; `status` marks a failed send for the retry affordance.
 */
export interface ThreadMessageVM {
  id: string;
  clientId: string | null;
  senderId: string;
  body: string | null;
  time: string;
  isOwn: boolean;
  status: "sending" | "sent" | "failed";
}

export interface ThreadPeerVM {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
}

export interface ThreadVM {
  conversationId: string;
  peer: ThreadPeerVM | null;
  messages: ThreadMessageVM[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  typing: boolean;
}

/** Payload for message:send. Mirrors the API's zod schema. */
export interface SendMessagePayload {
  conversationId: string;
  body?: string;
  media?: { kind: "image" | "video" | "file"; key: string; posterKey?: string }[];
  clientId?: string;
}

export type SendMessageAck =
  { ok: true; messageId: string; clientId?: string } | { ok: false; error: string };
