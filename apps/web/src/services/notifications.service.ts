import type { NotificationPagePM, NotificationPM } from "@/domain/notification";
import { api } from "./apiClient";

const CHANGE_EVENT = "kinkord:notifications-changed";
const STORAGE_KEY = "kinkord:notifications-updated";

/** Refresh this tab immediately, and other tabs when their inbox changes. */
export function notifyInboxChanged(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT));
  try {
    localStorage.setItem(STORAGE_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    /* Storage may be disabled. */
  }
}

export function listenForInboxChanges(onChange: () => void): () => void {
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  const push = (event: MessageEvent) => {
    if (event.data?.type === "kinkord:notification") onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", storage);
  navigator.serviceWorker?.addEventListener("message", push);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", storage);
    navigator.serviceWorker?.removeEventListener("message", push);
  };
}

export const notificationsApi = {
  list: (unread = false, cursor?: string | null, type?: "comment" | "mention") => {
    const query = new URLSearchParams();
    if (unread) query.set("unread", "true");
    if (type) query.set("type", type);
    if (cursor) query.set("cursor", cursor);
    return api.get<NotificationPagePM>(`/notifications${query.size ? `?${query}` : ""}`);
  },
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),
  read: async (id: string) => {
    const item = await api.post<NotificationPM>(
      `/notifications/${encodeURIComponent(id)}/read`,
      {},
    );
    notifyInboxChanged();
    return item;
  },
  readAll: async () => {
    await api.post<{ ok: true }>("/notifications/read-all", {});
    notifyInboxChanged();
  },
};

/** Combine pages without duplicates, keeping the most recently fetched read state. */
export function mergeNotifications(
  current: NotificationPM[],
  incoming: NotificationPM[],
): NotificationPM[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}
