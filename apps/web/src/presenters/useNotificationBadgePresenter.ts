"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeEventPM } from "@/domain/realtime";
import { listenForInboxChanges, notificationsApi } from "@/services/notifications.service";
import { useRealtime } from "./useRealtime";

/** Backstop checks: rare while live events arrive, more often while they can't. */
export const BADGE_POLL_MS = 60_000;
export const BADGE_FALLBACK_POLL_MS = 5 * 60_000;

/** Owned by the top-level screen's home presenter, never by a navigation component. */
export function useNotificationBadgePresenter(enabled: boolean) {
  const [count, setCount] = useState(0);
  const refreshRef = useRef<() => void>(() => undefined);
  const onRealtime = useCallback((e: RealtimeEventPM) => {
    if (e.type === "notification") refreshRef.current();
  }, []);
  const { live } = useRealtime(onRealtime, enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let request = 0;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      const mine = ++request;
      try {
        const result = await notificationsApi.unreadCount();
        if (active && mine === request) setCount(result.count);
      } catch {
        /* Keep the last known badge during a temporary connection failure. */
      }
    };
    const wake = () => void refresh();
    refreshRef.current = wake;
    wake();
    const stop = listenForInboxChanges(wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      refreshRef.current = () => undefined;
      stop();
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(
      () => refreshRef.current(),
      live ? BADGE_FALLBACK_POLL_MS : BADGE_POLL_MS,
    );
    return () => clearInterval(timer);
  }, [enabled, live]);

  return enabled && count > 0;
}
