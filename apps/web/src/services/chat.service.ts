/**
 * Chat API. Delivery is by asking: an open thread polls for anything newer than
 * its last message, because the API's host can't hold WebSockets open.
 */
import { notifyInboxChanged } from "./notifications.service";
import type {
  ChatAllowancePM,
  ChatMessagePM,
  ConversationSummaryPM,
  ConversationThreadPM,
  SentMessagePM,
  ChatInboxFilter,
  InboxCountsPM,
} from "@/domain/chat";
import { IMAGE_VARIANTS, buildUploadSet, type ImageVariant } from "@/util/image";
import { api, uploadToPresignedUrl } from "./apiClient";

const thread = (id: string) => `/chat/conversations/${encodeURIComponent(id)}`;

interface PhotoUploadSlot {
  key: string;
  uploadUrl: string;
  variantUploadUrls: Record<ImageVariant, string>;
}

const CHAT_READ_EVENT = "kinkord:chat-read";
export function listenForChatRead(onRead: () => void): () => void {
  window.addEventListener(CHAT_READ_EVENT, onRead);
  return () => window.removeEventListener(CHAT_READ_EVENT, onRead);
}

export const chatService = {
  seeInbox: async () => {
    const result = await api.post<{ ok: true }>("/chat/inbox-seen", {});
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(CHAT_READ_EVENT));
      notifyInboxChanged();
    }
    return result;
  },
  unreadCount: () => api.get<{ count: number }>("/chat/unread-count"),
  /** The inbox, newest first. A search or a tab looks through every chat, not just the latest. */
  list: (view: { q?: string; filter?: ChatInboxFilter } = {}) => {
    const params = new URLSearchParams();
    if (view.q?.trim()) params.set("q", view.q.trim());
    if (view.filter && view.filter !== "all") params.set("filter", view.filter);
    const query = params.toString();
    return api.get<ConversationSummaryPM[]>(`/chat/conversations${query ? `?${query}` : ""}`);
  },

  /** How many chats each tab holds, for a search or none. */
  counts: (q = "") =>
    api.get<InboxCountsPM>(
      `/chat/conversations/counts${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
    ),

  conversation: (id: string) => api.get<ConversationThreadPM>(thread(id)),

  start: (userId: string) =>
    api.post<{ conversationId: string }>("/chat/conversations", { userId }),

  /** `before` pages back through history; `after` fetches what's new. */
  history: (id: string, cursor: { before?: string; after?: string } = {}) => {
    const params = new URLSearchParams();
    if (cursor.before) params.set("before", cursor.before);
    if (cursor.after) params.set("after", cursor.after);
    const query = params.toString();
    return api.get<ChatMessagePM[]>(`${thread(id)}/messages${query ? `?${query}` : ""}`);
  },

  /** Text, a photo by its uploaded key, or both: the text is then its caption. */
  send: (id: string, body: string, clientId: string, photoKey?: string) =>
    api.post<SentMessagePM>(`${thread(id)}/messages`, {
      body,
      clientId,
      ...(photoKey ? { photoKey } : {}),
    }),

  /**
   * One photo into the thread's upload slot, in every stored size, before the
   * message exists. The key that comes back is what `send` names; a photo the
   * member never sends is simply never referenced.
   */
  uploadPhoto: async (id: string, rawFile: File): Promise<string> => {
    const { original, variants } = await buildUploadSet(rawFile, "chat");
    const slot = await api.post<PhotoUploadSlot>(`${thread(id)}/photo-upload-url`, {
      contentType: original.type,
      contentLength: original.size,
    });
    await Promise.all(
      IMAGE_VARIANTS.map((v) => uploadToPresignedUrl(slot.variantUploadUrls[v], variants[v])),
    );
    await uploadToPresignedUrl(slot.uploadUrl, original);
    return slot.key;
  },

  setTyping: (id: string, typing: boolean) =>
    api.post<{ ok: true }>(`${thread(id)}/typing`, { typing }),

  markRead: async (id: string, messageId: string) => {
    const result = await api.post<{ ok: true }>(`${thread(id)}/read`, { messageId });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(CHAT_READ_EVENT));
      notifyInboxChanged();
    }
    return result;
  },

  /** Today's new-chat allowance: how many first messages to someone new are left. */
  allowance: () => api.get<ChatAllowancePM>("/chat/allowance"),

  me: () => api.get<{ id: string }>("/me"),
};
