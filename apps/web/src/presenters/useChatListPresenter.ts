"use client";

import { useEffect, useState } from "react";
import type { ConversationRowVM, ConversationSummary } from "@/domain/chat";
import { chatService } from "@/services/chat.service";
import { chatSocket } from "@/services/chatSocket.service";
import { conversationTime } from "@/util/chatTime";
import { useHomePresenter } from "./useHomePresenter";

const PREVIEW_MAX = 60;

const preview = (summary: ConversationSummary, viewerId: string | null): string => {
  const last = summary.lastMessage;
  if (!last) return "Say hi 👋";
  const own = viewerId !== null && last.senderId === viewerId;
  const text = last.body?.trim() || (last.media.length ? "Sent an attachment" : "");
  const clipped = text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
  return own ? `You: ${clipped}` : clipped;
};

const peerOf = (summary: ConversationSummary, viewerId: string | null) =>
  summary.participants.find((p) => p.userId !== viewerId) ?? summary.participants[0];

export function useChatListPresenter() {
  const shell = useHomePresenter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewer id is what tells the row whose message it was previewing.
  useEffect(() => {
    let cancelled = false;
    chatService
      .me()
      .then((me) => !cancelled && setViewerId(me.id))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    chatService
      .listConversations()
      .then((rows) => {
        if (cancelled) return;
        setSummaries(rows);
        const peerIds = rows
          .map((r) => peerOf(r, null)?.userId)
          .filter((v): v is string => Boolean(v));
        if (peerIds.length === 0) return;
        chatService.presence(peerIds).then(({ online: ids }) => {
          if (!cancelled) setOnline(new Set(ids));
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);
  // Live: a new message bumps its conversation to the top of the list.
  useEffect(() => {
    const release = chatSocket.acquire();
    const offNew = chatSocket.on("message:new", (msg) => {
      setSummaries((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId);
        if (idx === -1) return prev; // a brand-new conversation: refresh on next visit
        const next = [...prev];
        const [row] = next.splice(idx, 1);
        // Bump and clear unread if the message is ours; otherwise add one.
        const unread = msg.senderId === viewerId ? row.unreadCount : row.unreadCount + 1;
        next.unshift({
          ...row,
          lastMessage: msg,
          lastMessageAt: msg.createdAt,
          unreadCount: unread,
        });
        return next;
      });
    });
    const offPresence = chatSocket.on("presence:update", ({ userId, online: on }) => {
      setOnline((prev) => {
        const next = new Set(prev);
        if (on) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });
    return () => {
      offNew();
      offPresence();
      release();
    };
  }, [viewerId]);

  const rows: ConversationRowVM[] = summaries.map((s) => {
    const peer = peerOf(s, viewerId);
    const isOnline = peer ? online.has(peer.userId) : false;
    return {
      id: s.id,
      href: `/messages/${s.id}`,
      displayName: peer?.displayName ?? "Member",
      avatarUrl: peer?.avatarUrl ?? null,
      preview: preview(s, viewerId),
      time: conversationTime(s.lastMessageAt),
      unread: s.unreadCount,
      isOnline,
    };
  });

  return {
    shell,
    list: {
      rows,
      loading,
      error,
      empty: !loading && !error && rows.length === 0,
    },
  };
}
