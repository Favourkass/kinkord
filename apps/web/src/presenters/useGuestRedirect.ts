"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/services/authClient";
import { Routes } from "@/constants/Routes";

/**
 * Guest-only guard for entry screens (landing, login, signup): if the visitor
 * already has a valid session, send them straight to the app home instead of
 * showing the marketing/login screen again. This is what makes reopening the
 * app land on /home once the session persists.
 *
 * Returns `checking` while the session lookup runs; callers may keep it true to
 * avoid flashing the guest screen, or ignore it and render optimistically.
 */
export function useGuestRedirect(): { checking: boolean } {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await authClient.getSession();
        if (cancelled) return;
        if (data?.session) {
          router.replace(Routes.appHome);
          return; // keep `checking` true so the guest screen never flashes in
        }
      } catch {
        // Network/transport error — treat as a guest and show the screen.
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { checking };
}
