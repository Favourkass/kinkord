export type NotificationKind =
  | "message"
  | "follow"
  | "friend_request"
  | "comment"
  | "mention"
  | "like"
  | "repost"
  | "report"
  | "test";

/**
 * GET /notifications item. Who did it is looked up when the inbox loads, so a
 * renamed or re-photographed member always shows as they are now.
 */
export interface NotificationPM {
  id: string;
  type: NotificationKind;
  actor: { name: string; username: string | null; avatarUrl: string | null } | null;
  url: string;
  /** Messages in a chat since its row was last read; 1 otherwise. */
  count: number;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPagePM {
  items: NotificationPM[];
  nextCursor: string | null;
}

export interface NotificationVM {
  id: string;
  /** The whole sentence, for screen readers. */
  body: string;
  category: string;
  actorName: string | null;
  avatarUrl: string | null;
  action: string;
  official: boolean;
  icon:
    | "message"
    | "person-add"
    | "friend-add"
    | "comment"
    | "heart"
    | "repost"
    | "shield"
    | "bell"
    | "mention";
  unread: boolean;
  time: string;
  dateTime: string;
  fullTime: string;
}

const KINDS: Record<
  NotificationKind,
  Pick<NotificationVM, "category" | "icon"> & { action: (count: number) => string }
> = {
  message: {
    category: "Message",
    icon: "message",
    action: (n) => (n > 1 ? `sent you ${n} messages.` : "sent you a message."),
  },
  friend_request: {
    category: "Friend request",
    icon: "friend-add",
    action: () => "sent you a friend request.",
  },
  follow: { category: "New follower", icon: "person-add", action: () => "followed you." },
  mention: { category: "Mention", icon: "mention", action: () => "mentioned you." },
  comment: { category: "Comment", icon: "comment", action: () => "commented on your post." },
  like: { category: "Like", icon: "heart", action: () => "liked your post." },
  repost: { category: "Repost", icon: "repost", action: () => "reposted your post." },
  report: { category: "Moderation", icon: "shield", action: () => "New report to review." },
  test: {
    category: "Notifications enabled",
    icon: "bell",
    action: () =>
      "Notifications are on. You'll hear about messages, followers and activity on your posts.",
  },
};

/** Kinkord's own notices, shown with the brand mark rather than a member. */
const OFFICIAL: ReadonlySet<NotificationKind> = new Set(["report", "test"]);

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
  const kind = KINDS[item.type];
  const official = OFFICIAL.has(item.type);
  const actorName = official ? null : (item.actor?.name ?? "A member");
  const action = kind.action(item.count);
  return {
    id: item.id,
    body: actorName ? `${actorName} ${action}` : action,
    category: kind.category,
    actorName,
    avatarUrl: official ? null : (item.actor?.avatarUrl ?? null),
    action,
    official,
    icon: kind.icon,
    unread: item.readAt === null,
    time,
    dateTime: item.createdAt,
    fullTime: date.toLocaleString("en-GB"),
  };
}

/** Only navigate to an internal path, including when opening a push link. */
export function notificationDestination(url: string): string | null {
  return /^\/(?!\/)/.test(url) && !/[\\\u0000- ]/.test(url) ? url : null;
}

export type NotificationTab = "all" | "comment" | "mention";
