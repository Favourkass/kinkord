import type { ChatInboxFilter, ConversationSummaryPM } from "@/domain/chat";

/** Filter saved conversation data without changing unread state or ordering. */
export function selectChatInbox(
  summaries: ConversationSummaryPM[],
  query: string,
  filter: ChatInboxFilter,
) {
  const term = query.trim().toLocaleLowerCase();
  const matches = summaries.filter(
    (s) =>
      !term ||
      [s.peer?.displayName, s.peer?.username, s.lastMessage?.body].some((value) =>
        value?.toLocaleLowerCase().includes(term),
      ),
  );
  const buckets = {
    all: matches,
    unread: matches.filter((s) => s.unreadCount > 0),
    online: matches.filter((s) => s.peer?.online),
    groups: matches.filter((s) => s.kind === "group"),
  };
  return {
    items: buckets[filter],
    counts: {
      all: buckets.all.length,
      unread: buckets.unread.length,
      online: buckets.online.length,
      groups: buckets.groups.length,
    },
  };
}
