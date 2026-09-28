/**
 * Chat API. Delivery is by asking: an open thread polls for anything newer than
 * its last message, because the API's host can't hold WebSockets open.
 */
import type { ChatMessagePM, ConversationSummaryPM, SentMessagePM } from "@/domain/chat";
import { api } from "./apiClient";

const thread = (id: string) => `/chat/conversations/${encodeURIComponent(id)}`;

export const chatService = {
  list: () => api.get<ConversationSummaryPM[]>("/chat/conversations"),

  conversation: (id: string) => api.get<ConversationSummaryPM>(thread(id)),

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

  send: (id: string, body: string, clientId: string) =>
    api.post<SentMessagePM>(`${thread(id)}/messages`, { body, clientId }),

  markRead: (id: string, messageId: string) =>
    api.post<{ ok: true }>(`${thread(id)}/read`, { messageId }),

  me: () => api.get<{ id: string }>("/me"),
};
