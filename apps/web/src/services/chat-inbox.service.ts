import type { ChatInboxFilter, ConversationSummaryPM } from "@/domain/chat";

const latest = (s: ConversationSummaryPM) =>
  Date.parse(s.lastMessage?.createdAt ?? s.lastMessageAt ?? "") || 0;

/**
 * The inbox as the tabs and the search show it, without changing saved data.
 * A search matches the loaded chats at once; `found` is the API's answer for
 * the same search across every chat, which adds older ones it turned up.
 */
export function selectChatInbox(
  summaries: ConversationSummaryPM[],
  query: string,
  filter: ChatInboxFilter,
  found: ConversationSummaryPM[] | null = null,
) {
  const term = query.trim().toLocaleLowerCase();
  const loaded = summaries.filter(
    (s) =>
      !term ||
      [s.peer?.displayName, s.peer?.username, s.lastMessage?.body].some((value) =>
        value?.toLocaleLowerCase().includes(term),
      ),
  );
  let matches = loaded;
  if (term && found) {
    const shown = new Set(loaded.map((s) => s.id));
    // A chat that's loaded is shown as loaded: that copy is the freshest.
    const byId = new Map(summaries.map((s) => [s.id, s]));
    const more = found.filter((s) => !shown.has(s.id)).map((s) => byId.get(s.id) ?? s);
    matches = [...loaded, ...more].sort((a, b) => latest(b) - latest(a));
  }
  const buckets = {
    all: matches,
    unread: matches.filter((s) => s.unreadCount > 0),
    online: matches.filter((s) => s.peer?.online),
  };
  return {
    items: buckets[filter],
    counts: {
      all: buckets.all.length,
      unread: buckets.unread.length,
      online: buckets.online.length,
    },
  };
}
