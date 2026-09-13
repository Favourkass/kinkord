export type User = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type Attachment = {
  id: string;
  key: string;
  filename: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  url?: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  clientId?: string | null;
  createdAt: string;
  attachments: Attachment[];
  // local-only
  pending?: boolean;
  failed?: boolean;
};

export type Conversation = {
  id: string;
  type: 'dm' | 'group';
  title: string | null;
  participants: User[];
  lastMessage: Message | null;
  lastMessageAt: string | null;
  unreadCount: number;
};