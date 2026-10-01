"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `tick` straight away and then every `intervalMs`, but only while the tab
 * is visible and `enabled` is true. A hidden tab asks for nothing, and coming
 * back to it catches up at once. A tick still running when the next is due is
 * not doubled up, so a slow network can't stack requests.
 */
export function usePolling(tick: () => Promise<void> | void, intervalMs: number, enabled: boolean) {
  const latest = useRef(tick);
  useEffect(() => {
    latest.current = tick;
  }, [tick]);

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      if (running) return;
      running = true;
      try {
        await latest.current();
      } finally {
        running = false;
      }
    };
    const start = () => {
      if (timer === null) timer = setInterval(() => void run(), intervalMs);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void run();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      void run();
      start();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
