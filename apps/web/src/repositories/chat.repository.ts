import { fetchJson } from "./http";
import type { ChatMessage, ConversationSummary } from "@/domain/chat";

export const chatRepository = {
  listConversations: () => fetchJson<ConversationSummary[]>("/chat/conversations"),

  startDm: (userId: string) =>
    fetchJson<{ conversationId: string }>("/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  history: (conversationId: string, before?: string, limit = 50) => {
    const params = new URLSearchParams();
    if (before) params.set("before", before);
    params.set("limit", String(limit));
    return fetchJson<ChatMessage[]>(
      `/chat/conversations/${conversationId}/messages?${params.toString()}`,
    );
  },

  markRead: (conversationId: string, messageId: string) =>
    fetchJson<{ ok: true }>(`/chat/conversations/${conversationId}/read`, {
      method: "POST",
      body: JSON.stringify({ messageId }),
    }),

  presence: (userIds: string[]) =>
    fetchJson<{ online: string[] }>(`/chat/presence?userIds=${userIds.join(",")}`),

  me: () => fetchJson<{ id: string }>("/me"),
};
