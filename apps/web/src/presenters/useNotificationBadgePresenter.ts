"use client";

import { useEffect, useState } from "react";
import { listenForInboxChanges, notificationsApi } from "@/services/notifications.service";

/** Owned by the top-level screen's home presenter, never by a navigation component. */
export function useNotificationBadgePresenter(enabled: boolean) {
  const [count, setCount] = useState(0);
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
    void refresh();
    const wake = () => void refresh();
    const stop = listenForInboxChanges(wake);
    const timer = setInterval(wake, 30_000);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      clearInterval(timer);
      stop();
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled]);
  return enabled && count > 0;
}
