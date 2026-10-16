"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { toHeldCheckVM, type HeldCheckPM } from "@/domain/subscription";
import { silverChecksAdminService } from "@/services/subscription.service";

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/**
 * The Payments tab's Silver checks waiting for a look: members who changed
 * their name, username or photo, longest waiting first, each approved in a tap.
 */
export function useAdminSilverChecksPresenter(isAdmin: boolean) {
  const copy = MODERATION_COPY.silverChecks;
  const [held, setHeld] = useState<HeldCheckPM[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    silverChecksAdminService.held().then(
      (rows) => live && setHeld(rows),
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [isAdmin]);

  const rows = useMemo(
    () =>
      (held ?? []).map((pm) => ({
        ...toHeldCheckVM(pm, Routes.moderationMember, copy.changes),
        busy: busy === pm.userId,
      })),
    [busy, copy, held],
  );

  const approve = useCallback(
    async (userId: string) => {
      const row = held?.find((r) => r.userId === userId);
      if (!row || busy) return;
      setBusy(userId);
      setError(null);
      setNotice(null);
      try {
        await silverChecksAdminService.approve(userId);
        setHeld((h) => h && h.filter((r) => r.userId !== userId));
        setNotice(copy.approved(row.displayName));
      } catch (e) {
        setError(messageOf(e));
      } finally {
        setBusy(null);
      }
    },
    [busy, copy, held],
  );

  return {
    loading: isAdmin && held === null && error === null,
    error,
    notice,
    empty: held !== null && held.length === 0,
    rows,
    onApprove: (userId: string) => void approve(userId),
    labels: {
      title: copy.title,
      hint: copy.hint,
      loading: copy.loading,
      empty: copy.empty,
      approve: copy.approve,
      approving: copy.approving,
    },
  };
}
