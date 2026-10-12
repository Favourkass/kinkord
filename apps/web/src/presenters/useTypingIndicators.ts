"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimeEventPM } from "@/domain/realtime";

/** How long "typing…" shows after the last hint: the sender repeats it every 5s while typing. */
export const TYPING_HINT_MS = 8_000;

/** Live hints belong to this screen, not saved conversation data. */
export function useTypingIndicators() {
  const [active, setActive] = useState<ReadonlyMap<string, number>>(new Map());
  const clear = useCallback(() => setActive(new Map()), []);
  const receive = useCallback((event: RealtimeEventPM) => {
    if (event.type !== "typing" && event.type !== "message") return;
    setActive((current) => {
      const next = new Map(current);
      // Timed from when it arrives, by this device's clock, so a phone whose clock
      // runs fast or slow still shows it for the same few seconds.
      if (event.type === "typing" && event.typing)
        next.set(event.conversationId, Date.now() + TYPING_HINT_MS);
      else next.delete(event.conversationId);
      return next;
    });
  }, []);
  useEffect(() => {
    if (!active.size) return;
    const timer = setTimeout(
      () => {
        const now = Date.now();
        setActive((current) => new Map([...current].filter(([, until]) => until > now)));
      },
      Math.max(0, Math.min(...active.values()) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [active]);
  return { active, receive, clear };
}
