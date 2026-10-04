"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeEventPM } from "@/domain/realtime";
import { chatService, listenForChatRead } from "@/services/chat.service";
import { listenForInboxChanges } from "@/services/notifications.service";
import { BADGE_FALLBACK_POLL_MS, BADGE_POLL_MS } from "./useNotificationBadgePresenter";
import { useRealtime } from "./useRealtime";

/** Unread chat messages, apart from the inbox count: opening an alert does not read its chat. */
export function useMessageBadgePresenter(enabled: boolean) {
  const [count, setCount] = useState(0);
  const refreshRef = useRef<() => void>(() => undefined);
  // A chat event (a new message, or a read on another device) can change the count.
  const onRealtime = useCallback((e: RealtimeEventPM) => {
    if (e.type === "message") refreshRef.current();
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
        const result = await chatService.unreadCount();
        if (active && mine === request) setCount(result.count);
      } catch {
        /* Keep the last known count while offline. */
      }
    };
    const wake = () => void refresh();
    refreshRef.current = wake;
    wake();
    const stopRead = listenForChatRead(wake);
    const stopPush = listenForInboxChanges(wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      refreshRef.current = () => undefined;
      stopRead();
      stopPush();
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled]);

  // The same backstop as the notification badge: rare while live events arrive.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(
      () => refreshRef.current(),
      live ? BADGE_FALLBACK_POLL_MS : BADGE_POLL_MS,
    );
    return () => clearInterval(timer);
  }, [enabled, live]);

  return enabled ? count : 0;
}
