import type { ChatInboxFilter, ConversationSummaryPM, InboxCountsPM } from "@/domain/chat";

const latest = (s: ConversationSummaryPM) =>
  Date.parse(s.lastMessage?.createdAt ?? s.lastMessageAt ?? "") || 0;

const inTab: Record<ChatInboxFilter, (s: ConversationSummaryPM) => boolean> = {
  all: () => true,
  unread: (s) => s.unreadCount > 0,
  online: (s) => Boolean(s.peer?.online),
};

/**
 * The inbox as the tabs and the search show it, without changing saved data.
 * The loaded chats (the latest page) answer at once. `found` is the API's
 * answer for the same tab and search across every chat, which adds older ones;
 * `counts` is its count of every chat, used once it's in.
 */
export function selectChatInbox(
  summaries: ConversationSummaryPM[],
  query: string,
  filter: ChatInboxFilter,
  found: ConversationSummaryPM[] | null = null,
  counts: InboxCountsPM | null = null,
) {
  const term = query.trim().toLocaleLowerCase();
  const loaded = summaries.filter(
    (s) =>
      !term ||
      [s.peer?.displayName, s.peer?.username, s.lastMessage?.body].some((value) =>
        value?.toLocaleLowerCase().includes(term),
      ),
  );
  let pool = loaded;
  if (found) {
    const shown = new Set(loaded.map((s) => s.id));
    // A chat that's loaded is shown as loaded: that copy is the freshest.
    const byId = new Map(summaries.map((s) => [s.id, s]));
    const more = found.filter((s) => !shown.has(s.id)).map((s) => byId.get(s.id) ?? s);
    pool = [...loaded, ...more].sort((a, b) => latest(b) - latest(a));
  }
  return {
    items: pool.filter(inTab[filter]),
    counts: counts ?? {
      all: pool.length,
      unread: pool.filter(inTab.unread).length,
      online: pool.filter(inTab.online).length,
    },
  };
}
