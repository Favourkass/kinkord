"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { isCheckFreePath } from "@/domain/locationCheck";
import { locationCheckService } from "@/services/locationCheck.service";

/** Asked at most this often, however quickly the member moves between pages. */
const ASK_EVERY_MS = 2 * 60 * 1000;

/**
 * Takes a member whose country check is due to it when they open a page, not
 * in the middle of one: the API only refuses requests outright while
 * enforcing, and even then not for a check that's merely nearly due or a
 * connection that moved country, so nobody loses a half-typed message.
 */
export function useLocationCheckWatcherPresenter() {
  const pathname = usePathname();
  const router = useRouter();
  const lastAsked = useRef(0);

  useEffect(() => {
    if (!pathname || isCheckFreePath(pathname)) return;
    const now = Date.now();
    if (now - lastAsked.current < ASK_EVERY_MS) return;
    lastAsked.current = now;
    let live = true;
    locationCheckService.due().then(
      (due) => {
        if (live && due) {
          router.push(Routes.locationCheckFrom(window.location.pathname + window.location.search));
        }
      },
      // Signed out, offline or switched off: nothing to ask.
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [pathname, router]);
}
