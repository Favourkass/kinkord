/** 24h clock for a bubble footer, localized to the browser. */
export function bubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Conversation-list stamp: "14:32" today, "Yesterday", weekday within a week,
 * else a short date. Matches what a chat app is expected to show at a glance.
 */
export function conversationTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (diff <= 0) return bubbleTime(iso);
  if (diff === dayMs) return "Yesterday";
  if (diff < 7 * dayMs) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

/** "Online" when the peer has a live socket, else null (do not invent "last seen"). */
export function presenceLabel(online: boolean): string | null {
  return online ? "Online" : null;
}

/** Local calendar dates, so midnight and daylight-saving changes group correctly. */
export interface ChatDayVM {
  key: string;
  label: string;
  fullLabel: string;
}

export function chatDay(iso: string, now: Date = new Date()): ChatDayVM {
  const date = new Date(iso);
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const key = keyOf(date);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const fullLabel = date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    key,
    label: key === keyOf(now) ? "Today" : key === keyOf(yesterday) ? "Yesterday" : fullLabel,
    fullLabel,
  };
}
