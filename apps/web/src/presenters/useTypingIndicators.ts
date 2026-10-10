"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimeEventPM } from "@/domain/realtime";

/** Live hints belong to this screen, not saved conversation data. */
export function useTypingIndicators() {
  const [active, setActive] = useState<ReadonlyMap<string, number>>(new Map());
  const clear = useCallback(() => setActive(new Map()), []);
  const receive = useCallback((event: RealtimeEventPM) => {
    if (event.type !== "typing" && event.type !== "message") return;
    setActive((current) => {
      const next = new Map(current);
      const now = Date.now();
      if (event.type === "typing" && event.typing && event.expiresAt > now) {
        // Never let a malformed or clock-skewed hint linger indefinitely.
        next.set(event.conversationId, Math.min(event.expiresAt, now + 8_000));
      } else next.delete(event.conversationId);
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
