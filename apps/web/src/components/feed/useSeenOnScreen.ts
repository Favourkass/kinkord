"use client";

import { useEffect, useRef, type RefObject } from "react";

/** A card counts as seen once this share of it (or of the screen) has shown... */
const SEEN_SHARE = 0.5;
/** ...for this long without scrolling away. */
const SEEN_MS = 1000;

/**
 * Calls `onSeen` once, when the element has been half on screen for a second.
 * A card taller than two screens counts once it fills half the screen. Without
 * `onSeen`, nothing is watched.
 */
export function useSeenOnScreen(
  ref: RefObject<Element | null>,
  onSeen: (() => void) | undefined,
): void {
  const latest = useRef(onSeen);
  useEffect(() => {
    latest.current = onSeen;
  });
  const watching = Boolean(onSeen);

  useEffect(() => {
    const node = ref.current;
    if (!watching || !node || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.some(
          (e) =>
            e.isIntersecting &&
            (e.intersectionRatio >= SEEN_SHARE ||
              (e.rootBounds !== null &&
                e.intersectionRect.height >= e.rootBounds.height * SEEN_SHARE)),
        );
        if (shown && !timer) {
          timer = setTimeout(() => {
            io.disconnect();
            latest.current?.();
          }, SEEN_MS);
        } else if (!shown && timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.25, SEEN_SHARE, 0.75, 1] },
    );
    io.observe(node);
    return () => {
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, [ref, watching]);
}
