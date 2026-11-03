"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { toMemberRingsVM, type MemberRingsPM } from "@/domain/kinkRings";
import { planDate } from "@/domain/subscription";
import { kinkRingsAdminApi } from "@/services/kinkRings.service";
import type { AdminDialogVM } from "./useAdminMemberPresenter";

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

type Pending = { kind: "unused"; count: number } | { kind: "silver"; ringId: string; who: string };

/**
 * A member's Kink Rings on their admin page: what each Silver payment
 * brought, who each ring went to and when, when the rest run out, and the
 * rings others gave them. Notes stay between the members: only that one was
 * sent shows here. Admins can take back the rings they still have, or the
 * month of Silver a ring gave, always saying why.
 */
export function useAdminMemberRingsPresenter(userId: string, isAdmin: boolean) {
  const copy = MODERATION_COPY.memberRings;
  // Kept with whom it was loaded for, so another member's page never shows it.
  const [loaded, setLoaded] = useState<{ userId: string; rings: MemberRingsPM } | null>(null);
  const [failed, setFailed] = useState<{ userId: string; message: string } | null>(null);
  const [reloads, setReloads] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ userId: string; text: string } | null>(null);

  useEffect(() => {
    if (!isAdmin || !userId) return;
    let live = true;
    kinkRingsAdminApi.forMember(userId).then(
      (rings) => live && setLoaded({ userId, rings }),
      (e: unknown) => live && setFailed({ userId, message: messageOf(e) }),
    );
    return () => {
      live = false;
    };
  }, [isAdmin, userId, reloads]);

  const rings = loaded?.userId === userId ? loaded.rings : null;
  const error = failed?.userId === userId ? failed.message : null;
  const vm = useMemo(
    () => (rings ? toMemberRingsVM(rings, copy, Routes.moderationMember) : null),
    [rings, copy],
  );

  const ask = useCallback((next: Pending) => {
    setPending(next);
    setReason("");
    setDialogError(null);
  }, []);

  const cancel = useCallback(() => {
    if (busy) return;
    setPending(null);
    setDialogError(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    const why = reason.trim();
    if (!pending || !why || busy) return;
    setBusy(true);
    setDialogError(null);
    try {
      let text: string;
      if (pending.kind === "unused") {
        const done = await kinkRingsAdminApi.cancelUnused(userId, why);
        text = copy.cancelledUnused(done.cancelled);
      } else {
        const done = await kinkRingsAdminApi.cancelSilver(pending.ringId, why);
        text = copy.cancelledSilver(done.silverUntil ? planDate(done.silverUntil) : null);
      }
      setNotice({ userId, text });
      setPending(null);
    } catch (e) {
      setDialogError(messageOf(e));
    } finally {
      setBusy(false);
      // Done or refused, show the rings as they stand now.
      setReloads((n) => n + 1);
    }
  }, [busy, copy, pending, reason, userId]);

  const dialog = useMemo<AdminDialogVM | null>(() => {
    if (!pending) return null;
    const text =
      pending.kind === "unused"
        ? {
            title: copy.cancelUnusedDialog.title(pending.count),
            body: copy.cancelUnusedDialog.body,
            confirm: copy.cancelUnusedDialog.confirm,
          }
        : {
            title: copy.cancelSilverDialog.title,
            body: copy.cancelSilverDialog.body(pending.who),
            confirm: copy.cancelSilverDialog.confirm,
          };
    return {
      title: text.title,
      body: text.body,
      confirmLabel: text.confirm,
      cancelLabel: copy.goBack,
      destructive: true,
      reason: { label: copy.reason, value: reason, set: setReason },
      checkbox: null,
      typeToConfirm: null,
      canConfirm: reason.trim().length > 0 && !busy,
      busy,
      error: dialogError,
      confirm: () => void confirm(),
      cancel,
    };
  }, [busy, cancel, confirm, copy, dialogError, pending, reason]);

  return {
    title: copy.title,
    loading: isAdmin && !rings && !error ? copy.loading : null,
    empty: vm?.empty ? copy.empty : null,
    receivedTitle: copy.receivedTitle,
    vm,
    error,
    notice: notice?.userId === userId ? notice.text : null,
    cancelUnusedLabel: vm?.canCancelUnused ? copy.cancelUnused : null,
    onCancelUnused: () => {
      if (vm) ask({ kind: "unused", count: vm.unused });
    },
    cancelSilverLabel: copy.cancelSilver,
    onCancelSilver: (ringId: string, who: string) => ask({ kind: "silver", ringId, who }),
    dialog,
  };
}

export type AdminMemberRingsVM = ReturnType<typeof useAdminMemberRingsPresenter>;
