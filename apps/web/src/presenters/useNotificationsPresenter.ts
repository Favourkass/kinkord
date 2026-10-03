"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NOTIFICATIONS_COPY } from "@/constants/notifications";
import { Routes } from "@/constants/Routes";
import {
  notificationDestination,
  searchNotifications,
  type NotificationTab,
  type NotificationPagePM,
  toNotificationVM,
  type NotificationPM,
} from "@/domain/notification";
import {
  listenForInboxChanges,
  mergeNotifications,
  notificationsApi,
} from "@/services/notifications.service";

export function useNotificationsPresenter(ready: boolean, openId: string | null = null) {
  const router = useRouter();
  const [tab, setTab] = useState<NotificationTab>("all");
  const [query, setQuery] = useState("");
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

  const filterKey = `${unreadOnly}-${tab}`;

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
      try {
        // Re-read loaded pages too: reads made on another device must clear
        // older dots, including while the Unread filter is selected.
        let nextCursor: string | null = null;
        let refreshed: NotificationPM[] = [];
        for (let page = 0; page < depth; page++) {
          const result: NotificationPagePM = await (tab === "all"
            ? notificationsApi.list(unreadOnly, nextCursor)
            : notificationsApi.list(unreadOnly, nextCursor, tab));
          refreshed = mergeNotifications(refreshed, result.items);
          nextCursor = result.nextCursor;
          if (!nextCursor) break;
        }
        if (
          generation.current !== mine ||
          request !== order ||
          version !== revision.current ||
          pageCount.current !== depth
        )
          return;
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
    const timer = setInterval(wake, 30_000);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      generation.current = mine + 1;
      clearInterval(timer);
      stop();
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [ready, unreadOnly, retry, tab, filterKey]);

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
        const item = await notificationsApi.read(id);
        revision.current++;
        setItems((previous) => previous.map((row) => (row.id === id ? item : row)));
        if (navigate) router.push(notificationDestination(item.url) ?? Routes.notifications);
      } catch {
        setError(NOTIFICATIONS_COPY.readError);
      } finally {
        busy.current = false;
        setOpening(null);
      }
    },
    [router],
  );

  const markAll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setMarkingAll(true);
    setError(null);
    try {
      await notificationsApi.readAll();
      revision.current++;
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
      const result: NotificationPagePM = await (tab === "all"
        ? notificationsApi.list(unreadOnly, cursor)
        : notificationsApi.list(unreadOnly, cursor, tab));
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
  }, [cursor, unreadOnly, tab]);

  const visibleItems = useMemo(
    () =>
      loadedFor === filterKey
        ? searchNotifications(items, query)
            .filter((item) => !unreadOnly || item.readAt === null)
            .map((item) => toNotificationVM(item))
        : [],
    [items, loadedFor, unreadOnly, filterKey, query],
  );

  return {
    items: visibleItems,
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
