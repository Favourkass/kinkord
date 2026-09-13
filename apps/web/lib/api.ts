const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function req<T>(path: string, userId: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-user-id': userId,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  me: (u: string) => req<User>('/users/me', u),
  users: (u: string) => req<User[]>('/users', u),
  conversations: (u: string) => req<Conversation[]>('/conversations', u),
  createDm: (u: string, otherId: string) =>
    req<{ id: string }>('/conversations/dm', u, {
      method: 'POST',
      body: JSON.stringify({ userId: otherId }),
    }),
  messages: (u: string, convId: string, before?: string) =>
    req<Message[]>(
      `/conversations/${convId}/messages${before ? `?before=${before}` : ''}`,
      u,
    ),
  markRead: (u: string, convId: string, messageId: string) =>
    req<void>(`/conversations/${convId}/read`, u, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    }),
  presign: (u: string, filename: string, mime: string, size: number) =>
    req<{ attachmentId: string; key: string; uploadUrl: string }>('/uploads/presign', u, {
      method: 'POST',
      body: JSON.stringify({ filename, mime, size }),
    }),
};

import type { Conversation, Message, User } from './types';