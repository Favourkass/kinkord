import type { ConversationPM, MessagePM } from "@/domain/chat";

const STORAGE_KEY_CONVERSATIONS = "kinkord_chat_conversations_v1";
const STORAGE_KEY_MESSAGES = "kinkord_chat_messages_v1";

const SEED_TIMESTAMP_BASE = new Date();
const timeMinus = (minutes: number) =>
  new Date(SEED_TIMESTAMP_BASE.getTime() - minutes * 60 * 1000).toISOString();
const timeMinusDays = (days: number) =>
  new Date(SEED_TIMESTAMP_BASE.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const SEED_MESSAGES_ROSABEL: MessagePM[] = [
  {
    id: "msg-r1",
    conversationId: "conv-rosabel",
    senderId: "user-rosabel",
    senderName: "Rosabel",
    text: "I have someone else asking to be my sub",
    type: "text",
    createdAt: timeMinus(65),
    readStatus: "read",
  },
  {
    id: "msg-r2",
    conversationId: "conv-rosabel",
    senderId: "current-user",
    senderName: "You",
    text: "I understand",
    type: "text",
    createdAt: timeMinus(65),
    readStatus: "read",
  },
  {
    id: "msg-r3",
    conversationId: "conv-rosabel",
    senderId: "user-rosabel",
    senderName: "Rosabel",
    text: "But I like the results",
    type: "text",
    createdAt: timeMinus(64),
    readStatus: "read",
  },
  {
    id: "msg-r4",
    conversationId: "conv-rosabel",
    senderId: "user-rosabel",
    senderName: "Rosabel",
    text: "Want to see ? 🥺🥺",
    type: "text",
    createdAt: timeMinus(64),
    readStatus: "read",
  },
  {
    id: "msg-r5",
    conversationId: "conv-rosabel",
    senderId: "current-user",
    senderName: "You",
    text: "Sure",
    type: "text",
    createdAt: timeMinus(63),
    readStatus: "read",
  },
  {
    id: "msg-r6",
    conversationId: "conv-rosabel",
    senderId: "user-rosabel",
    senderName: "Rosabel",
    text: "Daddy don't be clipped with me o\nThese one/ two word responses I don't like it o\n🥺",
    type: "text",
    createdAt: timeMinus(60),
    readStatus: "read",
    replyTo: {
      id: "msg-r2",
      senderName: "You",
      text: "I understand",
    },
  },
  {
    id: "msg-r7",
    conversationId: "conv-rosabel",
    senderId: "user-rosabel",
    senderName: "Rosabel",
    text: "Or are you upset at me",
    type: "text",
    createdAt: timeMinus(58),
    readStatus: "read",
  },
  {
    id: "msg-r8",
    conversationId: "conv-rosabel",
    senderId: "current-user",
    senderName: "You",
    text: "Oh, sorry dear, lemme see",
    type: "text",
    createdAt: timeMinus(50),
    readStatus: "read",
  },
  {
    id: "msg-r9",
    conversationId: "conv-rosabel",
    senderId: "user-rosabel",
    senderName: "Rosabel",
    text: "Wait first\nAre you okay fr ?",
    type: "text",
    createdAt: timeMinus(45),
    readStatus: "read",
  },
  {
    id: "msg-r10",
    conversationId: "conv-rosabel",
    senderId: "current-user",
    senderName: "You",
    text: "Yes I'm fine babe",
    type: "text",
    createdAt: timeMinus(44),
    readStatus: "read",
  },
  {
    id: "msg-r11",
    conversationId: "conv-rosabel",
    senderId: "user-rosabel",
    senderName: "Rosabel",
    text: "I somehow don't believe you",
    type: "text",
    createdAt: timeMinus(42),
    readStatus: "read",
    replyTo: {
      id: "msg-r10",
      senderName: "You",
      text: "Yes I'm fine babe",
    },
  },
  {
    id: "msg-r12",
    conversationId: "conv-rosabel",
    senderId: "user-rosabel",
    senderName: "Rosabel",
    text: "I love you old man",
    type: "text",
    createdAt: timeMinus(40),
    readStatus: "read",
  },
  {
    id: "msg-r13",
    conversationId: "conv-rosabel",
    senderId: "current-user",
    senderName: "You",
    text: "Id do full health check up today, just some health issues,",
    type: "text",
    createdAt: timeMinus(38),
    readStatus: "read",
  },
];

const SEED_CONVERSATIONS: ConversationPM[] = [
  {
    id: "conv-rosabel",
    type: "direct",
    name: "Rosabel",
    username: "rosabel",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
    isOnline: true,
    isPinned: true,
    isFavorite: true,
    unreadCount: 1,
    updatedAt: timeMinus(38),
    disappearingDays: 7,
    lastMessage: SEED_MESSAGES_ROSABEL[10], // "I somehow don't believe you"
  },
  {
    id: "conv-david",
    type: "direct",
    name: "David",
    username: "david",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
    isOnline: true,
    isPinned: false,
    isFavorite: false,
    unreadCount: 2,
    updatedAt: timeMinus(75),
    lastMessage: {
      id: "msg-d1",
      conversationId: "conv-david",
      senderId: "user-david",
      senderName: "David",
      text: "Sure, I'll check it out",
      type: "text",
      createdAt: timeMinus(75),
      readStatus: "delivered",
    },
  },
  {
    id: "conv-project-alpha",
    type: "group",
    name: "Project Alpha",
    avatarUrl: null,
    isOnline: true,
    isPinned: false,
    isMuted: true,
    isFavorite: false,
    unreadCount: 5,
    updatedAt: timeMinus(140),
    lastMessage: {
      id: "msg-pa1",
      conversationId: "conv-project-alpha",
      senderId: "user-mike",
      senderName: "Mike",
      text: "Presentation updated",
      type: "text",
      createdAt: timeMinus(140),
      readStatus: "delivered",
    },
  },
  {
    id: "conv-jessica",
    type: "direct",
    name: "Jessica",
    username: "jessica",
    avatarUrl:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
    isOnline: true,
    isPinned: false,
    isFavorite: true,
    unreadCount: 0,
    updatedAt: timeMinusDays(1),
    lastMessage: {
      id: "msg-j1",
      conversationId: "conv-jessica",
      senderId: "current-user",
      senderName: "You",
      text: "Can we reschedule our meeting?",
      type: "text",
      createdAt: timeMinusDays(1),
      readStatus: "read",
    },
  },
  {
    id: "conv-mark-daniel",
    type: "direct",
    name: "Mark Daniel",
    username: "markdaniel",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
    isOnline: false,
    isPinned: false,
    isFavorite: false,
    unreadCount: 0,
    updatedAt: timeMinusDays(1),
    lastMessage: {
      id: "msg-m1",
      conversationId: "conv-mark-daniel",
      senderId: "current-user",
      senderName: "You",
      text: "Okay, thanks!",
      type: "text",
      createdAt: timeMinusDays(1),
      readStatus: "read",
    },
  },
  {
    id: "conv-sophie",
    type: "direct",
    name: "Sophie",
    username: "sophie",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
    isOnline: false,
    isPinned: false,
    isFavorite: false,
    unreadCount: 0,
    updatedAt: timeMinusDays(3),
    lastMessage: {
      id: "msg-s1",
      conversationId: "conv-sophie",
      senderId: "user-sophie",
      senderName: "Sophie",
      text: "Shared a photo",
      type: "photo",
      createdAt: timeMinusDays(3),
      readStatus: "read",
    },
  },
  {
    id: "conv-chris",
    type: "direct",
    name: "Chris",
    username: "chris",
    avatarUrl:
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&q=80",
    isOnline: false,
    isPinned: false,
    isFavorite: false,
    unreadCount: 0,
    updatedAt: timeMinusDays(4),
    lastMessage: {
      id: "msg-c1",
      conversationId: "conv-chris",
      senderId: "current-user",
      senderName: "You",
      text: "Alright, see you there",
      type: "text",
      createdAt: timeMinusDays(4),
      readStatus: "read",
    },
  },
];

let inMemoryConversations: ConversationPM[] = [...SEED_CONVERSATIONS];
const inMemoryMessages: Record<string, MessagePM[]> = {
  "conv-rosabel": [...SEED_MESSAGES_ROSABEL],
  "conv-david": [SEED_CONVERSATIONS[1].lastMessage!],
  "conv-project-alpha": [SEED_CONVERSATIONS[2].lastMessage!],
  "conv-jessica": [SEED_CONVERSATIONS[3].lastMessage!],
  "conv-mark-daniel": [SEED_CONVERSATIONS[4].lastMessage!],
  "conv-sophie": [SEED_CONVERSATIONS[5].lastMessage!],
  "conv-chris": [SEED_CONVERSATIONS[6].lastMessage!],
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore quota or private-browsing errors
  }
}

export async function getConversations(): Promise<ConversationPM[]> {
  const stored = readStorage<ConversationPM[] | null>(STORAGE_KEY_CONVERSATIONS, null);
  if (stored && Array.isArray(stored)) {
    inMemoryConversations = stored;
  }
  return [...inMemoryConversations];
}

export async function getConversationById(id: string): Promise<ConversationPM | null> {
  const all = await getConversations();
  return all.find((c) => c.id === id) ?? null;
}

export async function getConversationByUsername(username: string): Promise<ConversationPM | null> {
  const clean = username.trim().toLowerCase().replace(/^@/, "");
  const all = await getConversations();
  return all.find((c) => c.username?.toLowerCase() === clean) ?? null;
}

export async function getMessages(conversationId: string): Promise<MessagePM[]> {
  const stored = readStorage<Record<string, MessagePM[]> | null>(STORAGE_KEY_MESSAGES, null);
  if (stored && stored[conversationId]) {
    inMemoryMessages[conversationId] = stored[conversationId];
  }
  return [...(inMemoryMessages[conversationId] ?? [])];
}

export async function saveMessage(message: MessagePM): Promise<MessagePM> {
  if (!inMemoryMessages[message.conversationId]) {
    inMemoryMessages[message.conversationId] = [];
  }
  inMemoryMessages[message.conversationId].push(message);

  // Update conversation lastMessage & updatedAt
  const convIndex = inMemoryConversations.findIndex((c) => c.id === message.conversationId);
  if (convIndex !== -1) {
    inMemoryConversations[convIndex] = {
      ...inMemoryConversations[convIndex],
      lastMessage: message,
      updatedAt: message.createdAt,
      unreadCount:
        message.senderId === "current-user" ? 0 : inMemoryConversations[convIndex].unreadCount + 1,
    };
  }

  writeStorage(STORAGE_KEY_MESSAGES, inMemoryMessages);
  writeStorage(STORAGE_KEY_CONVERSATIONS, inMemoryConversations);

  return message;
}

export async function createConversation(input: {
  name: string;
  username?: string;
  avatarUrl?: string | null;
  type?: "direct" | "group";
}): Promise<ConversationPM> {
  const newConv: ConversationPM = {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type ?? "direct",
    name: input.name,
    username: input.username,
    avatarUrl: input.avatarUrl ?? null,
    isOnline: true,
    isPinned: false,
    isFavorite: false,
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
    lastMessage: null,
  };

  inMemoryConversations = [newConv, ...inMemoryConversations];
  inMemoryMessages[newConv.id] = [];

  writeStorage(STORAGE_KEY_CONVERSATIONS, inMemoryConversations);
  writeStorage(STORAGE_KEY_MESSAGES, inMemoryMessages);

  return newConv;
}

export async function markAsRead(conversationId: string): Promise<void> {
  const convIndex = inMemoryConversations.findIndex((c) => c.id === conversationId);
  if (convIndex !== -1) {
    inMemoryConversations[convIndex] = {
      ...inMemoryConversations[convIndex],
      unreadCount: 0,
    };
    writeStorage(STORAGE_KEY_CONVERSATIONS, inMemoryConversations);
  }
}
