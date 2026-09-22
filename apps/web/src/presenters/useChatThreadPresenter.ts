"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, SendMessagePayload, ThreadMessageVM, ThreadPeerVM } from "@/domain/chat";
import { chatService } from "@/services/chat.service";
import { chatSocket } from "@/services/chatSocket.service";
import { bubbleTime } from "@/util/chatTime";
import { useHomePresenter } from "./useHomePresenter";

const TYPING_TIMEOUT_MS = 3000;

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * One conversation. Messages are stored oldest-first so rendering is a plain
 * map and a new message is a push. Optimistic rows carry a `clientId`; the ack
 * swaps in the server id, and a `message:new` for the same id is a no-op.
 */
export function useChatThreadPresenter(conversationId: string) {
  const shell = useHomePresenter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessageVM[]>([]);
  const [peer, setPeer] = useState<ThreadPeerVM | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = loadedId !== conversationId;
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Needed inside socket callbacks that outlive the effect that installed them.
  const viewerIdRef = useRef<string | null>(null);
  useEffect(() => {
    viewerIdRef.current = viewerId;
  }, [viewerId]);

  // Who am I — determines "own" bubbles and identifies the peer in the header.
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

  // Load peers and the first page of history.
  useEffect(() => {
    let cancelled = false;
    Promise.all([chatService.listConversations(), chatService.history(conversationId)])
      .then(([convs, history]) => {
        if (cancelled) return;
        const conv = convs.find((c) => c.id === conversationId);
        const me = viewerIdRef.current;
        const other = conv?.participants.find((p) => p.userId !== me) ?? null;
        setPeer(
          other
            ? {
                userId: other.userId,
                displayName: other.displayName,
                avatarUrl: other.avatarUrl,
                isOnline: false,
              }
            : null,
        );
        setMessages(
          history
            .slice()
            .reverse()
            .map((m) => ({
              id: m.id,
              clientId: null,
              senderId: m.senderId,
              body: m.body,
              time: bubbleTime(m.createdAt),
              isOwn: m.senderId === me,
              status: "sent" as const,
            })),
        );
        setHasMore(history.length >= 50);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => {
        if (!cancelled) setLoadedId(conversationId);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Live stream: new messages, read receipts, typing, presence.
  useEffect(() => {
    const release = chatSocket.acquire();
    const offNew = chatSocket.on("message:new", (raw: ChatMessage) => {
      if (raw.conversationId !== conversationId) return;
      const me = viewerIdRef.current;
      setMessages((prev) => {
        // The ack for this same message may already have landed on the
        // sender's socket; skip if so.
        if (prev.some((m) => m.id === raw.id)) return prev;
        return [
          ...prev,
          {
            id: raw.id,
            clientId: null,
            senderId: raw.senderId,
            body: raw.body,
            time: bubbleTime(raw.createdAt),
            isOwn: raw.senderId === me,
            status: "sent",
          },
        ];
      });
      if (raw.senderId !== viewerIdRef.current) chatSocket.markRead(conversationId, raw.id);
    });
    const offTyping = chatSocket.on("typing", (p) => {
      if (p.conversationId !== conversationId || p.userId === viewerIdRef.current) return;
      setTyping(p.isTyping);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (p.isTyping) {
        typingTimer.current = setTimeout(() => setTyping(false), TYPING_TIMEOUT_MS);
      }
    });
    const offPresence = chatSocket.on("presence:update", ({ userId, online }) => {
      setPeer((prev) => (prev && prev.userId === userId ? { ...prev, isOnline: online } : prev));
    });
    return () => {
      offNew();
      offTyping();
      offPresence();
      release();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [conversationId]);

  // First paint: mark the newest message read so the row badge clears.
  useEffect(() => {
    if (loading || messages.length === 0) return;
    const newest = messages[messages.length - 1];
    if (!newest.isOwn && newest.status === "sent") {
      chatSocket.markRead(conversationId, newest.id);
    }
  }, [loading, messages, conversationId]);

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text) return;
      const clientId = uid();
      const me = viewerIdRef.current;
      // Optimistic bubble: visible immediately, replaced on ack.
      const optimistic: ThreadMessageVM = {
        id: clientId, // placeholder, replaced by server id on ack
        clientId,
        senderId: me ?? "",
        body: text,
        time: bubbleTime(new Date().toISOString()),
        isOwn: true,
        status: "sending",
      };
      setMessages((prev) => [...prev, optimistic]);
      const payload: SendMessagePayload = { conversationId, body: text, clientId };
      const ack = await chatSocket.sendMessage(payload);
      if (!ack.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.clientId === clientId ? { ...m, status: "failed" } : m)),
        );
        return;
      }
      // The server broadcast may have already landed. Either way, drop the
      // optimistic row keyed by clientId; the real message is in the list.
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.clientId !== clientId);
        const already = withoutOptimistic.some((m) => m.id === ack.messageId);
        if (already) return withoutOptimistic;
        return [
          ...withoutOptimistic,
          {
            ...optimistic,
            id: ack.messageId,
            clientId: null,
            status: "sent",
          },
        ];
      });
    },
    [conversationId],
  );

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      chatSocket.typing(conversationId, isTyping);
    },
    [conversationId],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const page = await chatService.history(conversationId, oldest.id);
      const me = viewerIdRef.current;
      const flipped = page
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          clientId: null,
          senderId: m.senderId,
          body: m.body,
          time: bubbleTime(m.createdAt),
          isOwn: m.senderId === me,
          status: "sent" as const,
        }));
      setMessages((prev) => [...flipped, ...prev]);
      setHasMore(page.length >= 50);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, messages]);

  const vm = useMemo(
    () => ({ messages, loading, error, hasMore, loadingMore, typing, peer, conversationId }),
    [messages, loading, error, hasMore, loadingMore, typing, peer, conversationId],
  );

  return {
    shell,
    viewerId,
    thread: vm,
    send,
    notifyTyping,
    loadMore,
  };
}
