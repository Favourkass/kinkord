/**
 * Chat: what the API returns (PMs) and what the screens render (VMs). Routing
 * isn't known here, so presenters pass the href builders in.
 */
import { bubbleTime, conversationTime } from "@/util/chatTime";

/** Short-lived links to one chat photo, in the sizes the thread shows. */
export interface ChatPhotoPM {
  /** The 160px copy: what a blurred, not-yet-opened photo shows. */
  previewUrl: string;
  /** The 480px copy: the photo in its bubble. */
  thumbUrl: string;
  /** The full photo, for viewing on its own. */
  url: string;
}

export interface ChatMessagePM {
  id: string;
  conversationId: string;
  senderId: string;
  /** Empty for a photo sent without a caption. */
  body: string;
  photo: ChatPhotoPM | null;
  createdAt: string;
  editedAt: string | null;
}

/** The saved message the send call returns, with the client's id echoed back. */
export interface SentMessagePM extends ChatMessagePM {
  clientId: string | null;
}

export interface ChatPeerPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Shows the Silver check; absent from an older API. */
  silver?: boolean;
  verified?: boolean;
  presence?: "online" | "away" | "offline";
  typing?: boolean;
  online: boolean;
  /** The viewer blocked them: the thread stays, read-only until they unblock. */
  blockedByMe: boolean;
}

export interface ConversationSummaryPM {
  id: string;
  kind: "dm" | "group";
  lastMessageAt: string;
  /** Null when the other member has left Kinkord or been removed. */
  peer: ChatPeerPM | null;
  lastMessage: ChatMessagePM | null;
  unreadCount: number;
}

/** One open thread's header: the summary, plus whether photos are open in it. */
export interface ConversationThreadPM extends ConversationSummaryPM {
  /** Photos open up once the other member has written in the thread. */
  canSendPhotos: boolean;
}

/** A message the member has sent that the server hasn't confirmed yet. */
export interface PendingMessage {
  clientId: string;
  body: string;
  /** Its photo, uploaded already and shown from the device until the server's copy arrives. */
  photo: { localUrl: string; key: string } | null;
  createdAt: string;
  status: "sending" | "failed";
}

export type ChatInboxFilter = "all" | "unread" | "online" | "groups";

export interface ConversationRowVM {
  id: string;
  href: string;
  displayName: string;
  presenceLabel?: string;
  verifiedLabel?: string;
  verified?: boolean;
  presence?: "online" | "away" | "offline";
  typing?: boolean;
  silver: boolean;
  avatarUrl: string | null;
  preview: string;
  time: string;
  unread: number;
  sentByMe?: boolean;
  isOnline: boolean;
}

/** A photo in a bubble. Someone else's stays blurred until the viewer opens it. */
export interface ThreadPhotoVM {
  src: string;
  /** What a tap opens full size; null while it's hidden, or still only on this device. */
  fullSrc: string | null;
  hidden: boolean;
}

export interface ThreadMessageVM {
  id: string;
  /** Set on bubbles still waiting on the server, so a retry can find them. */
  clientId: string | null;
  senderId: string;
  body: string;
  photo: ThreadPhotoVM | null;
  time: string;
  isOwn: boolean;
  status: "sending" | "sent" | "failed";
}

export interface ThreadPeerVM {
  userId: string;
  displayName: string;
  presenceLabel?: string;
  verifiedLabel?: string;
  verified?: boolean;
  presence?: "online" | "away" | "offline";
  typing?: boolean;
  silver: boolean;
  avatarUrl: string | null;
  isOnline: boolean;
  blockedByMe: boolean;
  /** Their profile, opened by tapping them in the header. */
  profileHref: string;
}

const PREVIEW_MAX = 60;

export function previewOf(summary: ConversationSummaryPM, viewerId: string | null): string {
  const last = summary.lastMessage;
  if (!last) return "Say hi 👋";
  const caption = last.body.trim();
  const text = last.photo ? (caption ? `📷 ${caption}` : "📷 Photo") : caption;
  const clipped = text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
  return viewerId !== null && last.senderId === viewerId ? `You: ${clipped}` : clipped;
}

export function toConversationRowVM(
  summary: ConversationSummaryPM,
  viewerId: string | null,
  href: (conversationId: string) => string,
  now = new Date(),
): ConversationRowVM {
  return {
    id: summary.id,
    href: href(summary.id),
    displayName: summary.peer?.displayName ?? "Member",
    silver: Boolean(summary.peer?.silver),
    verified: Boolean(summary.peer?.verified),
    presence: summary.peer?.presence ?? (summary.peer?.online ? "online" : "offline"),
    typing: Boolean(summary.peer?.typing),
    avatarUrl: summary.peer?.avatarUrl ?? null,
    preview: previewOf(summary, viewerId),
    time: conversationTime(summary.lastMessage?.createdAt ?? summary.lastMessageAt, now),
    unread: summary.unreadCount,
    sentByMe:
      !!summary.lastMessage && viewerId !== null && summary.lastMessage.senderId === viewerId,
    isOnline: summary.peer?.online ?? false,
  };
}

/** `profileHref` takes the username, or the member id for someone without one. */
export function toThreadPeerVM(
  peer: ChatPeerPM | null,
  profileHref: (usernameOrId: string) => string,
): ThreadPeerVM | null {
  if (!peer) return null;
  return {
    userId: peer.userId,
    displayName: peer.displayName,
    silver: Boolean(peer.silver),
    verified: Boolean(peer.verified),
    presence: peer.presence ?? (peer.online ? "online" : "offline"),
    typing: Boolean(peer.typing),
    avatarUrl: peer.avatarUrl,
    isOnline: peer.online,
    blockedByMe: peer.blockedByMe,
    profileHref: profileHref(peer.username ?? peer.userId),
  };
}

/**
 * A hidden photo shows only its smallest copy, blurred: nothing larger reaches
 * the device until the viewer chooses to see it. The sender's own photos, and
 * ones the viewer has opened, show as they are.
 */
function toThreadPhotoVM(photo: ChatPhotoPM, shown: boolean): ThreadPhotoVM {
  return shown
    ? { src: photo.thumbUrl, fullSrc: photo.url, hidden: false }
    : { src: photo.previewUrl, fullSrc: null, hidden: true };
}

export function toThreadMessageVM(
  pm: ChatMessagePM,
  viewerId: string | null,
  revealed: ReadonlySet<string> = new Set(),
): ThreadMessageVM {
  const isOwn = viewerId !== null && pm.senderId === viewerId;
  return {
    id: pm.id,
    clientId: null,
    senderId: pm.senderId,
    body: pm.body,
    photo: pm.photo ? toThreadPhotoVM(pm.photo, isOwn || revealed.has(pm.id)) : null,
    time: bubbleTime(pm.createdAt),
    isOwn,
    status: "sent",
  };
}

export function toPendingMessageVM(p: PendingMessage, viewerId: string | null): ThreadMessageVM {
  return {
    id: p.clientId,
    clientId: p.clientId,
    senderId: viewerId ?? "",
    body: p.body,
    photo: p.photo ? { src: p.photo.localUrl, fullSrc: null, hidden: false } : null,
    time: bubbleTime(p.createdAt),
    isOwn: true,
    status: p.status,
  };
}

/**
 * Folds new messages into the thread: one copy of each, oldest first. The same
 * message can arrive twice — from the poll and from the send that created it —
 * so identity is the id, not arrival.
 */
export function mergeMessages(
  current: ChatMessagePM[],
  incoming: ChatMessagePM[],
): ChatMessagePM[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * How many new chats (a first message to someone) the member may start today.
 * The super admins have no limit.
 */
export type ChatAllowancePM =
  { newChatsPerDay: null } | { newChatsPerDay: number; usedToday: number; resetsAt: string };

/** The API's code for a first message refused because today's new chat is used. */
export const NEW_CHAT_LIMIT = "NEW_CHAT_LIMIT";

/** Whether an API error body is that refusal. */
export function isNewChatLimit(body: unknown): boolean {
  return (body as { code?: unknown } | null)?.code === NEW_CHAT_LIMIT;
}

/**
 * What an empty thread tells the member about today's allowance: "hint" when
 * sending here would use it, "blocked" when it's already used. Nothing once
 * the thread has messages, since replies aren't limited, and nothing for
 * members without a limit.
 */
export function newChatNotice(opts: {
  empty: boolean;
  allowance: ChatAllowancePM | null;
  refused: boolean;
}): "hint" | "blocked" | null {
  if (!opts.empty) return null;
  if (opts.refused) return "blocked";
  const a = opts.allowance;
  if (!a || a.newChatsPerDay === null) return null;
  return a.usedToday < a.newChatsPerDay ? "hint" : "blocked";
}

/**
 * Shape of the community rule shown before a member can use messaging. The
 * copy itself lives in constants/chatRules.ts.
 */
export type ChatRuleSectionKind = "plain" | "gift" | "warning";

export interface ChatRuleSection {
  kind: ChatRuleSectionKind;
  /** Marker glyph; plain sections have none. */
  icon?: string;
  title: string;
  /** Sentence before a bullet list; only used on plain sections. */
  lead?: string;
  /** Bullet items; only used on plain sections. */
  bullets?: string[];
  /** Paragraphs; only used on gift and warning sections. */
  paragraphs?: string[];
}
