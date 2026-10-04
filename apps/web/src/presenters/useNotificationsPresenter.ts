"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NOTIFICATIONS_COPY } from "@/constants/notifications";
import { Routes } from "@/constants/Routes";
import {
  notificationDestination,
  type NotificationTab,
  type NotificationPagePM,
  toNotificationVM,
  type NotificationPM,
} from "@/domain/notification";
import type { RealtimeEventPM } from "@/domain/realtime";
import {
  listenForInboxChanges,
  mergeNotifications,
  notificationsApi,
} from "@/services/notifications.service";
import { useRealtime } from "./useRealtime";

/** Backstop refreshes: rare while live events arrive, more often while they can't. */
export const INBOX_POLL_MS = 60_000;
export const INBOX_FALLBACK_POLL_MS = 5 * 60_000;
/** How long typing pauses before the search goes to the server. */
export const SEARCH_DEBOUNCE_MS = 300;

export function useNotificationsPresenter(ready: boolean, openId: string | null = null) {
  const router = useRouter();
  const [tabCounts, setTabCounts] = useState({ all: 0, comment: 0, mention: 0 });
  const [tab, setTab] = useState<NotificationTab>("all");
  const [query, setQuery] = useState("");
  // What the server is asked for: the box's text, once typing pauses.
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<NotificationPM[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const revision = useRef(0);
  const busy = useRef(false);
  const pageCount = useRef(1);
  const refreshRef = useRef<() => void>(() => undefined);

  const filterKey = `${unreadOnly}-${tab}-${search}`;

  useEffect(() => {
    const term = query.trim();
    const timer = setTimeout(() => setSearch(term), term ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [query]);

  const onRealtime = useCallback((e: RealtimeEventPM) => {
    if (e.type === "notification") refreshRef.current();
  }, []);
  const { live } = useRealtime(onRealtime, ready);

  useEffect(() => {
    if (!ready) return;
    const mine = ++generation.current;
    pageCount.current = 1;
    let request = 0;
    let hasLoaded = false;
    const refresh = async () => {
      const order = ++request;
      const version = revision.current;
      const depth = pageCount.current;
      // The tab totals load alongside the pages, not before them.
      const countsRequest = notificationsApi.counts(true);
      // Awaited below; this only keeps a failure there from going unhandled
      // when a page read fails first.
      countsRequest.catch(() => undefined);
      try {
        // Re-read loaded pages too: reads made on another device must clear
        // older dots, including while the Unread filter is selected.
        let nextCursor: string | null = null;
        let refreshed: NotificationPM[] = [];
        for (let page = 0; page < depth; page++) {
          const result: NotificationPagePM = await notificationsApi.list({
            unread: unreadOnly,
            cursor: nextCursor,
            type: tab === "all" ? undefined : tab,
            q: search || undefined,
          });
          refreshed = mergeNotifications(refreshed, result.items);
          nextCursor = result.nextCursor;
          if (!nextCursor) break;
        }
        const counts = await countsRequest;
        if (
          generation.current !== mine ||
          request !== order ||
          version !== revision.current ||
          pageCount.current !== depth
        )
          return;
        setTabCounts(counts);
        setItems(refreshed);
        setCursor(nextCursor);
        setLoadedFor(filterKey);
        hasLoaded = true;
        setError(null);
      } catch {
        if (generation.current === mine && request === order) {
          if (!hasLoaded) {
            setItems([]);
            setCursor(null);
          }
          setLoadedFor(filterKey);
          setError(NOTIFICATIONS_COPY.error);
        }
      }
    };
    const wake = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    refreshRef.current = wake;
    wake();
    const stop = listenForInboxChanges(wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      generation.current = mine + 1;
      refreshRef.current = () => undefined;
      stop();
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [ready, unreadOnly, retry, tab, search, filterKey]);

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(
      () => refreshRef.current(),
      live ? INBOX_FALLBACK_POLL_MS : INBOX_POLL_MS,
    );
    return () => clearInterval(timer);
  }, [ready, live]);

  // OS push clicks land here first, including notifications older than the loaded page.
  useEffect(() => {
    if (!ready || !openId) return;
    let active = true;
    void notificationsApi
      .read(openId)
      .then((item) => {
        if (!active) return;
        revision.current++;
        router.replace(notificationDestination(item.url) ?? Routes.notifications);
      })
      .catch(() => {
        if (active) setError(NOTIFICATIONS_COPY.readError);
      });
    return () => {
      active = false;
    };
  }, [ready, openId, router, retry]);

  const openNotification = useCallback(
    async (id: string, navigate = true) => {
      if (busy.current) return;
      busy.current = true;
      setMenuId(null);
      setOpening(id);
      setError(null);
      try {
        const previousItem = items.find((row) => row.id === id);
        const item = await notificationsApi.read(id);
        revision.current++;
        if (previousItem?.readAt === null && previousItem.type !== "message") {
          setTabCounts((previous) => ({
            all: Math.max(0, previous.all - 1),
            comment: Math.max(0, previous.comment - (previousItem.type === "comment" ? 1 : 0)),
            mention: Math.max(0, previous.mention - (previousItem.type === "mention" ? 1 : 0)),
          }));
        }
        setItems((previous) => previous.map((row) => (row.id === id ? item : row)));
        refreshRef.current();
        if (navigate) router.push(notificationDestination(item.url) ?? Routes.notifications);
      } catch {
        setError(NOTIFICATIONS_COPY.readError);
      } finally {
        busy.current = false;
        setOpening(null);
      }
    },
    [router, items],
  );

  const markAll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setMarkingAll(true);
    setError(null);
    try {
      await notificationsApi.readAll();
      revision.current++;
      setTabCounts({ all: 0, comment: 0, mention: 0 });
      const readAt = new Date().toISOString();
      setItems((previous) => previous.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      refreshRef.current();
    } catch {
      setError(NOTIFICATIONS_COPY.readAllError);
    } finally {
      busy.current = false;
      setMarkingAll(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    const mine = generation.current;
    const version = revision.current;
    try {
      const result: NotificationPagePM = await notificationsApi.list({
        unread: unreadOnly,
        cursor,
        type: tab === "all" ? undefined : tab,
        q: search || undefined,
      });
      if (generation.current !== mine || version !== revision.current) return;
      pageCount.current++;
      setItems((previous) => mergeNotifications(previous, result.items));
      setCursor(result.nextCursor);
      setError(null);
    } catch {
      if (generation.current === mine) setError(NOTIFICATIONS_COPY.error);
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [cursor, unreadOnly, tab, search]);

  // The search itself ran on the server; only an item read here since stays filtered out.
  const deleteNotification = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    setMenuId(null);
    setOpening(id);
    try {
      await notificationsApi.delete(id);
      revision.current++;
      setItems((previous) => previous.filter((item) => item.id !== id));
      refreshRef.current();
      setError(null);
    } catch {
      setError(NOTIFICATIONS_COPY.deleteError);
    } finally {
      busy.current = false;
      setOpening(null);
    }
  };
  const visibleItems = useMemo(
    () =>
      loadedFor === filterKey
        ? items
            .filter((item) => !unreadOnly || item.readAt === null)
            .map((item) => toNotificationVM(item))
        : [],
    [items, loadedFor, unreadOnly, filterKey],
  );

  return {
    items: visibleItems,
    tabCounts,
    deleteNotification,
    tab,
    setTab,
    query,
    setQuery,
    searchOpen,
    toggleSearch: () => {
      if (searchOpen) setQuery("");
      setSearchOpen(!searchOpen);
    },
    menuId,
    setMenuId,
    markRead: (id: string) => openNotification(id, false),
    loading: !ready || loadedFor !== filterKey,
    loadingMore,
    opening,
    markingAll,
    error,
    unreadOnly,
    hasMore: Boolean(cursor),
    hasUnread: items.some((item) => item.readAt === null),
    setUnreadOnly,
    openNotification,
    markAll,
    loadMore,
    refresh: () => setRetry((value) => value + 1),
  };
}
