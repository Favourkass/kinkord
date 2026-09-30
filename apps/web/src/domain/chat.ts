/**
 * Chat: what the API returns (PMs) and what the screens render (VMs). Routing
 * isn't known here, so presenters pass the href builders in.
 */
import { bubbleTime, conversationTime } from "@/util/chatTime";

export interface ChatMessagePM {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
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
  online: boolean;
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

/** A message the member has sent that the server hasn't confirmed yet. */
export interface PendingMessage {
  clientId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
}

export interface ConversationRowVM {
  id: string;
  href: string;
  displayName: string;
  avatarUrl: string | null;
  preview: string;
  time: string;
  unread: number;
  isOnline: boolean;
}

export interface ThreadMessageVM {
  id: string;
  /** Set on bubbles still waiting on the server, so a retry can find them. */
  clientId: string | null;
  senderId: string;
  body: string;
  time: string;
  isOwn: boolean;
  status: "sending" | "sent" | "failed";
}

export interface ThreadPeerVM {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
}

const PREVIEW_MAX = 60;

export function previewOf(summary: ConversationSummaryPM, viewerId: string | null): string {
  const last = summary.lastMessage;
  if (!last) return "Say hi 👋";
  const text = last.body.trim();
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
    avatarUrl: summary.peer?.avatarUrl ?? null,
    preview: previewOf(summary, viewerId),
    time: conversationTime(summary.lastMessage?.createdAt ?? summary.lastMessageAt, now),
    unread: summary.unreadCount,
    isOnline: summary.peer?.online ?? false,
  };
}

export function toThreadPeerVM(peer: ChatPeerPM | null): ThreadPeerVM | null {
  if (!peer) return null;
  return {
    userId: peer.userId,
    displayName: peer.displayName,
    avatarUrl: peer.avatarUrl,
    isOnline: peer.online,
  };
}

export function toThreadMessageVM(pm: ChatMessagePM, viewerId: string | null): ThreadMessageVM {
  return {
    id: pm.id,
    clientId: null,
    senderId: pm.senderId,
    body: pm.body,
    time: bubbleTime(pm.createdAt),
    isOwn: viewerId !== null && pm.senderId === viewerId,
    status: "sent",
  };
}

export function toPendingMessageVM(p: PendingMessage, viewerId: string | null): ThreadMessageVM {
  return {
    id: p.clientId,
    clientId: p.clientId,
    senderId: viewerId ?? "",
    body: p.body,
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
