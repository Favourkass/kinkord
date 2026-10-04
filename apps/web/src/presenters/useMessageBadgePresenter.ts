"use client";

import { useEffect, useState } from "react";
import { chatService, listenForChatRead } from "@/services/chat.service";
import { listenForInboxChanges } from "@/services/notifications.service";
import { realtime } from "@/services/realtime.service";

/** Separate from inbox counts: opening an alert does not read its conversation. */
export function useMessageBadgePresenter(enabled: boolean) {
  const [count, setCount] = useState(0);
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
    wake();
    const stopRead = listenForChatRead(wake);
    const stopPush = listenForInboxChanges(wake);
    const stopLive = realtime.listen(
      (event) => {
        if ("conversationId" in event) wake();
      },
      () => undefined,
    );
    const timer = setInterval(wake, 30_000);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      stopRead();
      stopPush();
      stopLive();
      clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled]);
  return enabled ? count : 0;
}
