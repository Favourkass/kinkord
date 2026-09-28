"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Routes } from "@/constants/Routes";
import { toConversationRowVM, type ConversationSummaryPM } from "@/domain/chat";
import { chatService } from "@/services/chat.service";
import { useHomePresenter } from "./useHomePresenter";
import { usePolling } from "./usePolling";

/** How often the inbox re-reads itself while it's on screen. */
export const LIST_POLL_MS = 10_000;

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
  usePolling(refresh, LIST_POLL_MS, true);

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
