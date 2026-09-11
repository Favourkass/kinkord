/**
 * Chat domain models (PMs) and display shapes (VMs).
 * PMs are the persistent/transport source of truth; to*VM functions shape them for UI presentation.
 */

export type ChatFilter = "all" | "unread" | "groups" | "favorites";

export type MessageType = "text" | "photo" | "attachment";
export type ReadStatus = "sent" | "delivered" | "read";

export interface QuotedMessagePM {
  id: string;
  senderName: string;
  text: string;
}

export interface MessagePM {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  text: string;
  type: MessageType;
  createdAt: string; // ISO 8601
  readStatus: ReadStatus;
  replyTo?: QuotedMessagePM | null;
}

export interface ConversationPM {
  id: string;
  type: "direct" | "group";
  name: string;
  username?: string;
  avatarUrl: string | null;
  isOnline: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isFavorite?: boolean;
  unreadCount: number;
  lastMessage?: MessagePM | null;
  updatedAt: string; // ISO 8601
  disappearingDays?: number | null;
}

export interface MessageVM {
  id: string;
  isOutgoing: boolean;
  senderName: string;
  text: string;
  timeLabel: string;
  readStatus: ReadStatus;
  type: MessageType;
  replyTo?: {
    senderName: string;
    text: string;
  } | null;
}

export interface ConversationVM {
  id: string;
  type: "direct" | "group";
  name: string;
  username?: string;
  avatarUrl: string | null;
  isOnline: boolean;
  isPinned: boolean;
  isMuted: boolean;
  isFavorite: boolean;
  unreadCount: number;
  unreadBadge: string | null;
  timeLabel: string;
  previewText: string;
  previewSenderPrefix?: string;
  readStatus?: ReadStatus;
  hasPhoto: boolean;
}

/** Formats a timestamp for the message bubble, e.g. "04:28". */
export function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Formats a timestamp for the conversation list row:
 * - Today: "04:32"
 * - Yesterday: "Yesterday"
 * - Within a week: "Mon", "Sun"
 * - Older: "dd/mm/yy" or localized date
 */
export function formatConversationTime(iso: string, now = new Date()): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";

    const isSameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (isSameDay) {
      return formatMessageTime(iso);
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();

    if (isYesterday) {
      return "Yesterday";
    }

    const daysDiff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return d.toLocaleDateString("en-US", { weekday: "short" });
    }

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function toMessageVM(pm: MessagePM, currentUserId?: string): MessageVM {
  const isOutgoing = Boolean(currentUserId && pm.senderId === currentUserId);
  return {
    id: pm.id,
    isOutgoing,
    senderName: isOutgoing ? "You" : pm.senderName,
    text: pm.text,
    timeLabel: formatMessageTime(pm.createdAt),
    readStatus: pm.readStatus,
    type: pm.type,
    replyTo: pm.replyTo
      ? {
          senderName:
            currentUserId && pm.replyTo.senderName === "You" ? "You" : pm.replyTo.senderName,
          text: pm.replyTo.text,
        }
      : null,
  };
}

export function toConversationVM(pm: ConversationPM, currentUserId?: string): ConversationVM {
  const lastMsg = pm.lastMessage;
  const isOutgoing = Boolean(currentUserId && lastMsg?.senderId === currentUserId);

  let previewSenderPrefix: string | undefined = undefined;
  if (pm.type === "group" && lastMsg && !isOutgoing) {
    previewSenderPrefix = `${lastMsg.senderName}: `;
  }

  let previewText = "No messages yet";
  let hasPhoto = false;

  if (lastMsg) {
    if (lastMsg.type === "photo") {
      hasPhoto = true;
      previewText = "Shared a photo";
    } else {
      previewText = lastMsg.text;
    }
  }

  return {
    id: pm.id,
    type: pm.type,
    name: pm.name,
    username: pm.username,
    avatarUrl: pm.avatarUrl,
    isOnline: pm.isOnline,
    isPinned: Boolean(pm.isPinned),
    isMuted: Boolean(pm.isMuted),
    isFavorite: Boolean(pm.isFavorite),
    unreadCount: pm.unreadCount,
    unreadBadge: pm.unreadCount > 0 ? String(pm.unreadCount) : null,
    timeLabel: formatConversationTime(lastMsg?.createdAt || pm.updatedAt),
    previewText,
    previewSenderPrefix,
    readStatus: isOutgoing ? (lastMsg?.readStatus ?? "sent") : undefined,
    hasPhoto,
  };
}
