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

/** Typing pauses this long before the search asks the API, so each keystroke isn't a request. */
const SEARCH_DEBOUNCE_MS = 300;

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
  // The API's answer to the search, across every chat, for the words it was asked.
  const [found, setFound] = useState<{ term: string; items: ConversationSummaryPM[] } | null>(null);
  const term = query.trim();

  useEffect(() => {
    if (!term) return;
    let live = true;
    const timer = setTimeout(() => {
      chatService.list(term).then(
        (items) => live && setFound({ term, items }),
        // The loaded chats still match while the wider search is unavailable.
        () => undefined,
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term]);
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
    () =>
      selectChatInbox(
        summaries ?? [],
        query,
        filter,
        found && found.term === term ? found.items : null,
      ),
    [summaries, query, filter, found, term],
  );
  const rows = useMemo(
    () =>
      selected.items.map((s) => {
        const row = toConversationRowVM(s, viewerId, Routes.messageThread);
        const isTyping = typing.has(s.id) && !s.peer?.blockedByMe;
        return {
          ...row,
          presenceLabel: CHAT_COPY.presence[row.presence ?? "offline"],
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
      closeMenu: () => setMenuOpen(false),
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
      emptyTitle: term || filter !== "all" ? CHAT_COPY.inbox.filteredEmpty : CHAT_COPY.emptyTitle,
      emptyBody: term || filter !== "all" ? CHAT_COPY.inbox.filteredBody : CHAT_COPY.emptyBody,
      loading: summaries === null && !error,
      error: summaries === null ? error : null,
      empty: summaries !== null && rows.length === 0,
    },
  };
}
