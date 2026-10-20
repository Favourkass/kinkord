"use client";
import { useEffect } from "react";
import { appBadgeService } from "@/services/app-badge.service";
import { listenForInboxChanges } from "@/services/notifications.service";
import { listenForChatRead } from "@/services/chat.service";

/** Open devices refresh on state changes and return from background/offline. */
export function useAppBadgePresenter(enabled: boolean, messages: number, notifications: number) {
  useEffect(() => {
    if (!enabled) return;
    const sync = () => {
      if (document.visibilityState !== "hidden") void appBadgeService.sync();
    };
    sync();
    const stopInbox = listenForInboxChanges(sync);
    const stopChat = listenForChatRead(sync);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stopInbox();
      stopChat();
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [enabled, messages, notifications]);
}
