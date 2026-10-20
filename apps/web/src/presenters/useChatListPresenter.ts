"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAT_COPY } from "@/constants/chat";
import { selectChatInbox } from "@/services/chat-inbox.service";
import { Routes } from "@/constants/Routes";
import {
  toConversationRowVM,
  type ConversationSummaryPM,
  type ChatInboxFilter,
  type InboxCountsPM,
} from "@/domain/chat";
import type { RealtimeEventPM } from "@/domain/realtime";
import { chatService } from "@/services/chat.service";
import { isOfficialOrganization } from "@/services/organization-placeholder.service";
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
  // Persist inbox attention, never conversation read pointers or tab counts.
  useEffect(() => {
    if (!shell.signedIn) return;
    const seen = () => {
      if (document.visibilityState !== "hidden") void chatService.seeInbox().catch(() => undefined);
    };
    seen();
    window.addEventListener("online", seen);
    window.addEventListener("focus", seen);
    document.addEventListener("visibilitychange", seen);
    return () => {
      window.removeEventListener("online", seen);
      window.removeEventListener("focus", seen);
      document.removeEventListener("visibilitychange", seen);
    };
  }, [shell.signedIn]);
  const { active: typing, receive: receiveTyping, clear: clearTyping } = useTypingIndicators();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ConversationSummaryPM[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChatInboxFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const term = query.trim();
  // A tab and search: the API's answer across every chat, and its counts.
  const view = `${filter}|${term}`;
  const [found, setFound] = useState<{
    view: string;
    items: ConversationSummaryPM[];
    /** Which request it answered: later requests read later data. */
    n: number;
  } | null>(null);
  // Which request the loaded inbox answered, to tell which copy of a chat is newer.
  const [loadedN, setLoadedN] = useState(0);
  const [counts, setCounts] = useState<{ term: string; value: InboxCountsPM } | null>(null);
  // What's on screen, for answers that land later: an answer for another view is dropped.
  const wanted = useRef({ term, filter, view });
  useEffect(() => {
    wanted.current = { term, filter, view };
  }, [term, filter, view]);
  // Requests are numbered: an answer that lands after a newer one of its kind is dropped.
  const issued = useRef(0);
  const accepted = useRef({ found: 0, counts: 0, inbox: 0 });
  const fetchView = useCallback((w: { term: string; filter: ChatInboxFilter; view: string }) => {
    const n = ++issued.current;
    // The loaded chats still answer while these are on their way, or unavailable.
    if (w.term || w.filter !== "all")
      chatService.list({ q: w.term, filter: w.filter }).then(
        (items) => {
          if (wanted.current.view !== w.view || n < accepted.current.found) return;
          accepted.current.found = n;
          setFound({ view: w.view, items, n });
        },
        () => undefined,
      );
    chatService.counts(w.term).then(
      (value) => {
        if (wanted.current.term !== w.term || n < accepted.current.counts) return;
        accepted.current.counts = n;
        setCounts({ term: w.term, value });
      },
      () => undefined,
    );
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () => fetchView({ term, filter, view }),
      term ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [term, filter, view, fetchView]);
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
    // The tab's and search's answers are refreshed with the inbox, so a chat
    // that's gone (a block, say) or has changed doesn't linger, and counts stay true.
    fetchView(wanted.current);
    const n = ++issued.current;
    try {
      const items = await chatService.list();
      if (n < accepted.current.inbox) return;
      accepted.current.inbox = n;
      setSummaries(items);
      setLoadedN(n);
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }, [fetchView]);
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
        found && found.view === view ? found.items : null,
        counts && counts.term === term ? counts.value : null,
        found !== null && found.n > loadedN,
      ),
    [summaries, query, filter, found, counts, term, view, loadedN],
  );
  const rows = useMemo(
    () =>
      selected.items.map((s) => {
        const row = toConversationRowVM(
          s,
          viewerId,
          Routes.messageThread,
          new Date(),
          isOfficialOrganization(s.peer?.userId),
        );
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
    shell: { ...shell, messagesCount: 0 },
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
