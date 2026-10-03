export type NotificationKind =
  "message" | "follow" | "comment" | "mention" | "like" | "repost" | "report" | "test";

export interface NotificationPM {
  id: string;
  type: NotificationKind;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  readAt: string | null;
  actor?: { name: string; avatarUrl: string | null } | null;
}

export interface NotificationPagePM {
  items: NotificationPM[];
  nextCursor: string | null;
}

export interface NotificationVM {
  id: string;
  body: string;
  category: string;
  actorName: string | null;
  avatarUrl: string | null;
  action: string;
  official: boolean;
  icon: "message" | "person-add" | "comment" | "heart" | "repost" | "shield" | "bell" | "mention";
  unread: boolean;
  time: string;
  dateTime: string;
  fullTime: string;
}

const KINDS: Record<NotificationKind, Pick<NotificationVM, "category" | "icon">> = {
  message: { category: "Message", icon: "message" },
  follow: { category: "New follower", icon: "person-add" },
  mention: { category: "Mention", icon: "mention" },
  comment: { category: "Comment", icon: "comment" },
  like: { category: "Like", icon: "heart" },
  repost: { category: "Repost", icon: "repost" },
  report: { category: "Moderation", icon: "shield" },
  test: { category: "Notifications enabled", icon: "bell" },
};

export function toNotificationVM(item: NotificationPM, now = new Date()): NotificationVM {
  const date = new Date(item.createdAt);
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  const time =
    minutes < 1
      ? "Just now"
      : minutes < 60
        ? `${minutes}m`
        : minutes < 1440
          ? `${Math.floor(minutes / 60)}h`
          : date.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
            });
  return {
    id: item.id,
    body: item.body,
    actorName: item.actor?.name ?? null,
    avatarUrl: item.actor?.avatarUrl ?? null,
    action: item.actor
      ? item.type === "message"
        ? "sent you a message."
        : item.body.startsWith(item.actor.name + " ")
          ? item.body.slice(item.actor.name.length).trim() + (/[.!?]$/.test(item.body) ? "" : ".")
          : item.body
      : item.body,
    official: item.type === "report" || item.type === "test",
    ...KINDS[item.type],
    unread: item.readAt === null,
    time,
    dateTime: item.createdAt,
    fullTime: date.toLocaleString("en-GB"),
  };
}

/** Only navigate to an internal path, including when opening a push link. */
export function notificationDestination(url: string): string | null {
  return /^\/(?!\/)/.test(url) && !/[\\\u0000-\u0020]/.test(url) ? url : null;
}

export type NotificationTab = "all" | "comment" | "mention";

export function searchNotifications(items: NotificationPM[], query: string): NotificationPM[] {
  const term = query.trim().toLocaleLowerCase();
  return term
    ? items.filter((item) =>
        `${item.actor?.name ?? ""} ${item.body}`.toLocaleLowerCase().includes(term),
      )
    : items;
}
