"use client";

import { useEffect, useRef } from "react";

export interface InfiniteSentinelProps {
  /** Called when the sentinel scrolls into view and `enabled` is true. */
  onVisible: () => void;
  enabled: boolean;
  loading: boolean;
  loadingText: string;
  /** Shown once there is nothing more to load; null hides the footer. */
  endText: string | null;
}

/** Infinite-scroll trigger + footer status (loading indicator / end of list). */
export default function InfiniteSentinel({
  onVisible,
  enabled,
  loading,
  loadingText,
  endText,
}: InfiniteSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible();
      },
      { rootMargin: "320px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [enabled, onVisible]);

  return (
    <div ref={ref} className="py-[18px] text-center text-[13px] text-app-muted" aria-live="polite">
      {loading ? (
        <span className="inline-flex items-center gap-[8px]">
          <span className="size-[14px] animate-spin rounded-full border-2 border-kink-amber border-t-transparent" />
          {loadingText}
        </span>
      ) : !enabled && endText ? (
        endText
      ) : null}
    </div>
  );
}
