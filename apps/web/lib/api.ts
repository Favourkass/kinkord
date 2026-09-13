const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  me: () => req<SessionUser>("/users/me"),
  conversations: () => req<Conversation[]>("/conversations"),
  createDm: (otherId: string) =>
    req<{ id: string }>("/conversations/dm", {
      method: "POST",
      body: JSON.stringify({ userId: otherId }),
    }),
  messages: (convId: string, before?: string) =>
    req<Message[]>(`/conversations/${convId}/messages${before ? `?before=${before}` : ""}`),
  markRead: (convId: string, messageId: string) =>
    req<void>(`/conversations/${convId}/read`, {
      method: "POST",
      body: JSON.stringify({ messageId }),
    }),
  presign: (filename: string, mime: string, size: number) =>
    req<{ attachmentId: string; key: string; uploadUrl: string }>("/uploads/presign", {
      method: "POST",
      body: JSON.stringify({ filename, mime, size }),
    }),
};

import type { Conversation, Message, SessionUser } from "./types";
