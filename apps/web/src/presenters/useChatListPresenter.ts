"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Routes } from "@/constants/Routes";
import { toConversationRowVM, type ConversationSummaryPM } from "@/domain/chat";
import type { RealtimeEventPM } from "@/domain/realtime";
import { chatService } from "@/services/chat.service";
import { useHomePresenter } from "./useHomePresenter";
import { usePolling } from "./usePolling";
import { useRealtime } from "./useRealtime";

/** How often the inbox re-reads itself while it's on screen without a live connection. */
export const LIST_POLL_MS = 10_000;
/** With one, any message re-reads it at once and polling is only a safety net. */
export const LIST_FALLBACK_POLL_MS = 60_000;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Couldn't load your messages.";
}

export function useChatListPresenter() {
  const shell = useHomePresenter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ConversationSummaryPM[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Whose message a preview shows ("You: …") depends on who is looking.
  useEffect(() => {
    let live = true;
    chatService.me().then(
      (me) => live && setViewerId(me.id),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSummaries(await chatService.list());
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);
  // Only chat events: inbox ones (likes, follows) don't change this list.
  const onRealtime = useCallback(
    (e: RealtimeEventPM) => {
      if (e.type === "message") void refresh();
    },
    [refresh],
  );
  const { live } = useRealtime(onRealtime);
  usePolling(refresh, live ? LIST_FALLBACK_POLL_MS : LIST_POLL_MS, true);

  const rows = useMemo(
    () => (summaries ?? []).map((s) => toConversationRowVM(s, viewerId, Routes.messageThread)),
    [summaries, viewerId],
  );

  return {
    shell,
    list: {
      rows,
      loading: summaries === null && !error,
      error: summaries === null ? error : null,
      empty: summaries !== null && summaries.length === 0,
    },
  };
}
