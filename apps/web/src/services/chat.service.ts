import type { ChatFilter, ConversationPM, MessagePM, QuotedMessagePM } from "@/domain/chat";
import * as chatRepo from "@/repositories/chat.repository";

export interface CreateMessageParams {
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  replyTo?: QuotedMessagePM | null;
}

/** Pure filter logic for the category chips: All, Unread, Groups, Favorites. */
export function filterConversations(
  conversations: ConversationPM[],
  filter: ChatFilter,
): ConversationPM[] {
  switch (filter) {
    case "unread":
      return conversations.filter((c) => c.unreadCount > 0);
    case "groups":
      return conversations.filter((c) => c.type === "group");
    case "favorites":
      return conversations.filter((c) => Boolean(c.isFavorite));
    case "all":
    default:
      return conversations;
  }
}

/** Case-insensitive search across contact name, username, and last message snippet. */
export function searchConversations(
  conversations: ConversationPM[],
  query: string,
): ConversationPM[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;
  return conversations.filter((c) => {
    if (c.name.toLowerCase().includes(q)) return true;
    if (c.username && c.username.toLowerCase().includes(q)) return true;
    if (c.lastMessage?.text.toLowerCase().includes(q)) return true;
    return false;
  });
}

/** Pinned conversations float to the top; both pinned and unpinned lists sort newest first. */
export function sortConversations(conversations: ConversationPM[]): ConversationPM[] {
  return [...conversations].sort((a, b) => {
    const aPinned = Boolean(a.isPinned);
    const bPinned = Boolean(b.isPinned);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt).getTime();
    const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt).getTime();
    return timeB - timeA;
  });
}

export function createMessagePM(params: CreateMessageParams): MessagePM {
  const text = params.text.trim();
  if (!text) {
    throw new Error("Message text cannot be empty");
  }
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: params.conversationId,
    senderId: params.senderId,
    senderName: params.senderName,
    text,
    type: "text",
    createdAt: new Date().toISOString(),
    readStatus: "read",
    replyTo: params.replyTo ?? null,
  };
}

export async function fetchConversations(): Promise<ConversationPM[]> {
  return chatRepo.getConversations();
}

export async function fetchConversationById(id: string): Promise<ConversationPM | null> {
  return chatRepo.getConversationById(id);
}

export async function fetchConversationByUsername(
  username: string,
): Promise<ConversationPM | null> {
  return chatRepo.getConversationByUsername(username);
}

export async function fetchMessages(conversationId: string): Promise<MessagePM[]> {
  return chatRepo.getMessages(conversationId);
}

export async function sendChatMessage(params: CreateMessageParams): Promise<MessagePM> {
  const pm = createMessagePM(params);
  return chatRepo.saveMessage(pm);
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  return chatRepo.markAsRead(conversationId);
}

export async function startNewConversation(input: {
  name: string;
  username?: string;
  avatarUrl?: string | null;
  type?: "direct" | "group";
}): Promise<ConversationPM> {
  return chatRepo.createConversation(input);
}

const ROSABEL_RESPONSES = [
  "Haha okay then! Don't work too hard 😉",
  "Aww, take care of yourself first! Let me know what the doctor says 💕",
  "You always say you're fine when you're not! Stay safe please 🥺",
  "Okay sounds like a plan. Can't wait to see you!",
];

export function getSimulatedResponse(conversationName: string): string {
  if (conversationName.toLowerCase().includes("rosabel")) {
    const idx = Math.floor(Math.random() * ROSABEL_RESPONSES.length);
    return ROSABEL_RESPONSES[idx];
  }
  return "Got it! Thanks for the update.";
}
