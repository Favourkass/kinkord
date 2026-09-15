"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/services/authClient";
import { Routes } from "@/constants/Routes";

interface Options {
  /**
   * Postpone the redirect without postponing the lookup. The entry screen uses
   * this to finish its intro animation first: navigating tears the screen down,
   * so an ungated redirect cuts the animation off mid-play (Favour, 2026-09-15).
   */
  hold?: boolean;
}

/**
 * Guest-only guard for entry screens (landing, login, signup): if the visitor
 * already has a valid session, send them straight to the app home instead of
 * showing the marketing/login screen again. This is what makes reopening the
 * app land on /home once the session persists.
 *
 * Returns `checking` while the session lookup runs, and keeps it true for a
 * member so the guest screen never flashes in before the route changes.
 */
export function useGuestRedirect({ hold = false }: Options = {}): { checking: boolean } {
  const router = useRouter();
  // null while the lookup is in flight; a failed lookup counts as a guest.
  const [member, setMember] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await authClient.getSession();
        if (!cancelled) setMember(Boolean(data?.session));
      } catch {
        // Network/transport error — treat as a guest and show the screen.
        if (!cancelled) setMember(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hold || member !== true) return;
    router.replace(Routes.appHome);
  }, [hold, member, router]);

  return { checking: member === null || member };
}
