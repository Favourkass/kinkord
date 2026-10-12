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
 * `counts` is its count of every chat, used once it's in. `foundIsNewer` says
 * which copy of a chat in both is the truer one: whichever was fetched last.
 */
export function selectChatInbox(
  summaries: ConversationSummaryPM[],
  query: string,
  filter: ChatInboxFilter,
  found: ConversationSummaryPM[] | null = null,
  counts: InboxCountsPM | null = null,
  foundIsNewer = false,
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
    const loadedById = new Map(summaries.map((s) => [s.id, s]));
    const foundById = new Map(found.map((s) => [s.id, s]));
    const freshest = (id: string) =>
      foundIsNewer
        ? (foundById.get(id) ?? loadedById.get(id)!)
        : (loadedById.get(id) ?? foundById.get(id)!);
    const ids = new Set([...loaded.map((s) => s.id), ...found.map((s) => s.id)]);
    pool = [...ids].map(freshest).sort((a, b) => latest(b) - latest(a));
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
