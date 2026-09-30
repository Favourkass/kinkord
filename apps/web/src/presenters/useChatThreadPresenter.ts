"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAT_COPY } from "@/constants/chat";
import { Routes } from "@/constants/Routes";
import {
  isNewChatLimit,
  mergeMessages,
  newChatNotice,
  toPendingMessageVM,
  toThreadMessageVM,
  toThreadPeerVM,
  type ChatAllowancePM,
  type ChatMessagePM,
  type ConversationSummaryPM,
  type PendingMessage,
} from "@/domain/chat";
import { ApiError } from "@/services/apiClient";
import { chatService } from "@/services/chat.service";
import { useHomePresenter } from "./useHomePresenter";
import { usePolling } from "./usePolling";

/** How often an open thread asks for new messages. */
export const THREAD_POLL_MS = 3_000;
/** How often it refreshes the header (is the other member still online?). */
export const HEADER_POLL_MS = 20_000;
/** Matches the API's page size: a full page means there may be more before it. */
const PAGE = 50;

const clientIdOf = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * One conversation. Saved messages are kept as they came from the API, oldest
 * first; bubbles still on their way live beside them until the server confirms
 * or refuses. Who "own" is gets decided at render, once the viewer is known.
 */
export function useChatThreadPresenter(conversationId: string) {
  const shell = useHomePresenter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversationSummaryPM | null>(null);
  const [messages, setMessages] = useState<ChatMessagePM[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Today's new-chat allowance, and whether the server refused a first message
  // here: each remembered with the thread it was for.
  const [allowance, setAllowance] = useState<{ for: string; value: ChatAllowancePM } | null>(null);
  const [refusedIn, setRefusedIn] = useState<string | null>(null);
  const lastMarked = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      chatService.me(),
      chatService.conversation(conversationId),
      chatService.history(conversationId),
    ]).then(
      ([me, header, page]) => {
        if (!live) return;
        setViewerId(me.id);
        setSummary(header);
        setMessages(page);
        setHasMore(page.length >= PAGE);
        setError(null);
        setLoadedFor(conversationId);
      },
      (e: unknown) => {
        if (!live) return;
        setError(messageOf(e, "Couldn't open this conversation."));
        setLoadedFor(conversationId);
      },
    );
    return () => {
      live = false;
    };
  }, [conversationId]);

  const loaded = loadedFor === conversationId && !error;
  // Nobody has written here yet: a first message would start a new chat.
  const empty = loaded && messages.length === 0 && pending.length === 0;

  useEffect(() => {
    if (!empty) return;
    let live = true;
    chatService.allowance().then(
      (value) => live && setAllowance({ for: conversationId, value }),
      // Without it the composer stays open; the server still enforces the limit.
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [empty, conversationId]);

  const pollNew = useCallback(async () => {
    const newest = messages[messages.length - 1];
    try {
      const fresh = await chatService.history(conversationId, newest ? { after: newest.id } : {});
      if (fresh.length > 0) setMessages((m) => mergeMessages(m, fresh));
    } catch {
      // A missed poll is caught up by the next one.
    }
  }, [conversationId, messages]);
  usePolling(pollNew, THREAD_POLL_MS, loaded);

  const pollHeader = useCallback(async () => {
    try {
      setSummary(await chatService.conversation(conversationId));
    } catch {
      // Keep showing the last known header.
    }
  }, [conversationId]);
  usePolling(pollHeader, HEADER_POLL_MS, loaded);

  // Tell the server what's been seen, so the inbox badge clears.
  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (!newest || !viewerId || newest.senderId === viewerId) return;
    if (lastMarked.current === newest.id) return;
    lastMarked.current = newest.id;
    chatService.markRead(conversationId, newest.id).catch(() => {
      lastMarked.current = null;
    });
  }, [conversationId, messages, viewerId]);

  const deliver = useCallback(
    async (clientId: string, body: string) => {
      try {
        const saved = await chatService.send(conversationId, body, clientId);
        setPending((p) => p.filter((x) => x.clientId !== clientId));
        setMessages((m) => mergeMessages(m, [saved]));
        setSendError(null);
      } catch (e) {
        if (e instanceof ApiError && isNewChatLimit(e.body)) {
          // Retrying can't help until tomorrow: say so instead of offering it.
          setPending((p) => p.filter((x) => x.clientId !== clientId));
          setRefusedIn(conversationId);
          setSendError(null);
          return;
        }
        setPending((p) => p.map((x) => (x.clientId === clientId ? { ...x, status: "failed" } : x)));
        setSendError(messageOf(e, "Couldn't send. Tap the message to try again."));
      }
    },
    [conversationId],
  );

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!body) return;
      const clientId = clientIdOf();
      setPending((p) => [
        ...p,
        { clientId, body, createdAt: new Date().toISOString(), status: "sending" },
      ]);
      void deliver(clientId, body);
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const item = pending.find((p) => p.clientId === clientId);
      if (!item || item.status !== "failed") return;
      setPending((p) => p.map((x) => (x.clientId === clientId ? { ...x, status: "sending" } : x)));
      void deliver(clientId, item.body);
    },
    [deliver, pending],
  );

  const loadMore = useCallback(async () => {
    const oldest = messages[0];
    if (!hasMore || loadingMore || !oldest) return;
    setLoadingMore(true);
    try {
      const page = await chatService.history(conversationId, { before: oldest.id });
      setMessages((m) => mergeMessages(page, m));
      setHasMore(page.length >= PAGE);
    } catch {
      // The button stays, so another tap retries.
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, messages]);

  const peer = useMemo(() => toThreadPeerVM(summary?.peer ?? null), [summary]);
  const notice = newChatNotice({
    empty,
    allowance: allowance?.for === conversationId ? allowance.value : null,
    refused: refusedIn === conversationId,
  });
  const bubbles = useMemo(
    () => [
      ...messages.map((m) => toThreadMessageVM(m, viewerId)),
      ...pending.map((p) => toPendingMessageVM(p, viewerId)),
    ],
    [messages, pending, viewerId],
  );

  return {
    shell,
    thread: {
      conversationId,
      peer,
      messages: bubbles,
      loading: loadedFor !== conversationId,
      error,
      sendError,
      hasMore,
      loadingMore,
      /** The other member left or was removed: read-only from here. */
      unavailable: loaded && peer === null,
      /** The daily new-chat allowance, shown while nobody has written yet. */
      newChat:
        notice === null
          ? null
          : {
              text: notice === "blocked" ? CHAT_COPY.newChatLimit : CHAT_COPY.newChatHint,
              blocking: notice === "blocked",
            },
    },
    backHref: Routes.messages,
    send,
    retry,
    loadMore: () => void loadMore(),
  };
}
