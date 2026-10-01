"use client";

import { useSyncExternalStore } from "react";

export interface VisibleViewport {
  height: number;
  top: number;
}

/**
 * The part of the screen the keyboard isn't covering. Phones shrink the
 * visual viewport for the keyboard but not the layout one, so a full-height
 * chat sat partly under it, and the browser scrolled the whole page up to show
 * the input, taking the header and messages with it. Sizing the thread to this
 * keeps the header put and the composer just above the keyboard. Null on the
 * server and in browsers without the API, where CSS (100dvh) takes over.
 */
export function useVisibleViewport(): VisibleViewport | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

let cached: { key: string; box: VisibleViewport } | null = null;

function snapshot(): VisibleViewport | null {
  const vv = typeof window === "undefined" ? undefined : window.visualViewport;
  if (!vv) return null;
  const key = `${vv.height}:${vv.offsetTop}`;
  // The same object until something changes, as useSyncExternalStore requires.
  if (cached?.key !== key) cached = { key, box: { height: vv.height, top: vv.offsetTop } };
  return cached.box;
}

function subscribe(onChange: () => void): () => void {
  const vv = typeof window === "undefined" ? undefined : window.visualViewport;
  if (!vv) return () => undefined;
  vv.addEventListener("resize", onChange);
  vv.addEventListener("scroll", onChange);
  return () => {
    vv.removeEventListener("resize", onChange);
    vv.removeEventListener("scroll", onChange);
  };
}
