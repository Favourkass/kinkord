"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeEventPM } from "@/domain/realtime";
import { realtime } from "@/services/realtime.service";

/**
 * Live events while this screen is open, and whether the connection is up.
 * Screens poll slowly while it is and quickly while it isn't, so nothing is
 * missed either way. `enabled` false holds off connecting, e.g. until the
 * member is known to be signed in.
 */
export function useRealtime(
  onEvent: (e: RealtimeEventPM) => void,
  enabled = true,
): { live: boolean } {
  const [live, setLive] = useState(false);
  const latest = useRef(onEvent);
  useEffect(() => {
    latest.current = onEvent;
  }, [onEvent]);
  useEffect(
    () => (enabled ? realtime.listen((e) => latest.current(e), setLive) : undefined),
    [enabled],
  );
  return { live: enabled && live };
}
