"use client";

import { useLocationCheckWatcherPresenter } from "@/presenters/useLocationCheckWatcherPresenter";

/** Mounted once in the root layout: asks members whose country check is due, page by page. */
export function LocationCheckWatcher() {
  useLocationCheckWatcherPresenter();
  return null;
}
