"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAT_COPY } from "@/constants/chat";
import { selectChatInbox } from "@/services/chat-inbox.service";
import { Routes } from "@/constants/Routes";
import {
  toConversationRowVM,
  type ConversationSummaryPM,
  type ChatInboxFilter,
} from "@/domain/chat";
import type { RealtimeEventPM } from "@/domain/realtime";
import { chatService } from "@/services/chat.service";
import { useHomePresenter } from "./useHomePresenter";
import { usePolling } from "./usePolling";
import { useTypingIndicators } from "./useTypingIndicators";
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
  const { active: typing, receive: receiveTyping, clear: clearTyping } = useTypingIndicators();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ConversationSummaryPM[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChatInboxFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
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
      receiveTyping(e);
      if (e.type === "message") void refresh();
    },
    [refresh, receiveTyping],
  );
  const { live } = useRealtime(onRealtime);
  useEffect(() => {
    if (!live) clearTyping();
  }, [live, clearTyping]);
  usePolling(refresh, live ? LIST_FALLBACK_POLL_MS : LIST_POLL_MS, true);

  const selected = useMemo(
    () => selectChatInbox(summaries ?? [], query, filter),
    [summaries, query, filter],
  );
  const rows = useMemo(
    () =>
      selected.items.map((s) => {
        const row = toConversationRowVM(s, viewerId, Routes.messageThread);
        const isTyping = typing.has(s.id) && !s.peer?.blockedByMe;
        return {
          ...row,
          presenceLabel: CHAT_COPY.presence[row.presence ?? "offline"],
          verifiedLabel: CHAT_COPY.verified,
          typing: isTyping,
          preview: isTyping ? CHAT_COPY.typing : row.preview,
        };
      }),
    [selected, viewerId, typing],
  );

  return {
    shell,
    list: {
      rows,
      query,
      setQuery,
      menuOpen,
      toggleMenu: () => setMenuOpen((v) => !v),
      openNavigation: () => {
        setMenuOpen(false);
        shell.openDrawer();
      },
      newChatHref: Routes.search,
      settingsHref: Routes.settings,
      filters: (Object.keys(CHAT_COPY.inbox.filters) as ChatInboxFilter[]).map((key) => ({
        key,
        label: CHAT_COPY.inbox.filters[key],
        count: selected.counts[key].toLocaleString("en-NG"),
        active: key === filter,
      })),
      setFilter,
      emptyTitle:
        filter === "groups"
          ? CHAT_COPY.inbox.groupsEmpty
          : query || filter !== "all"
            ? CHAT_COPY.inbox.filteredEmpty
            : CHAT_COPY.emptyTitle,
      emptyBody:
        filter === "groups"
          ? CHAT_COPY.inbox.groupsBody
          : query || filter !== "all"
            ? CHAT_COPY.inbox.filteredBody
            : CHAT_COPY.emptyBody,
      loading: summaries === null && !error,
      error: summaries === null ? error : null,
      empty: summaries !== null && rows.length === 0,
    },
  };
}
