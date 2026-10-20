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

export interface NotificationListOptions {
  unread?: boolean;
  cursor?: string | null;
  type?: "comment" | "mention";
  /** Searched by the API across the whole inbox, not just the loaded page. */
  q?: string;
}

type ViewedSnapshot = { id: string; createdAt: string; count: number };
let viewedQueue: {
  item: ViewedSnapshot;
  resolve: (value: { readIds: string[] }) => void;
  reject: (error: unknown) => void;
}[] = [];
let viewedTimer: ReturnType<typeof setTimeout> | undefined;

/** Batch rows entering the viewport together; the backend validates every version. */
function queueViewedRead(items: ViewedSnapshot[]): Promise<{ readIds: string[] }> {
  if (!items.length) return Promise.resolve({ readIds: [] });
  return Promise.all(
    items.map(
      (item) =>
        new Promise<{ readIds: string[] }>((resolve, reject) => {
          viewedQueue.push({ item, resolve, reject });
          if (viewedTimer) return;
          viewedTimer = setTimeout(() => {
            viewedTimer = undefined;
            const pending = viewedQueue;
            viewedQueue = [];
            // A viewport can never send an unbounded mutation.
            for (let start = 0; start < pending.length; start += 50) {
              const group = pending.slice(start, start + 50);
              void api
                .post<{ readIds: string[] }>("/notifications/read-viewed", {
                  items: group.map((entry) => entry.item),
                })
                .then(
                  (result) => {
                    notifyInboxChanged();
                    group.forEach((entry) => entry.resolve(result));
                  },
                  (error: unknown) => group.forEach((entry) => entry.reject(error)),
                );
            }
          }, 50);
        }),
    ),
  ).then((results) => ({ readIds: [...new Set(results.flatMap((result) => result.readIds))] }));
}

export const notificationsApi = {
  list: ({ unread = false, cursor, type, q }: NotificationListOptions = {}) => {
    const query = new URLSearchParams();
    if (unread) query.set("unread", "true");
    if (type) query.set("type", type);
    if (q?.trim()) query.set("q", q.trim());
    if (cursor) query.set("cursor", cursor);
    return api.get<NotificationPagePM>(`/notifications${query.size ? `?${query}` : ""}`);
  },
  counts: (unread = false) =>
    api.get<{ all: number; comment: number; mention: number }>(
      `/notifications/counts${unread ? "?unread=true" : ""}`,
    ),
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),
  read: async (id: string) => {
    const item = await api.post<NotificationPM>(
      `/notifications/${encodeURIComponent(id)}/read`,
      {},
    );
    notifyInboxChanged();
    return item;
  },
  delete: async (id: string) => {
    const result = await api.del<{ id: string }>(`/notifications/${encodeURIComponent(id)}`);
    notifyInboxChanged();
    return result;
  },
  readViewed: queueViewedRead,
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
