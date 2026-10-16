"use client";

import { useCallback, useEffect, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { toMemberCheckVM, type MemberCheckPM } from "@/domain/subscription";
import { silverChecksAdminService } from "@/services/subscription.service";
import type { AdminDialogVM } from "./useAdminMemberPresenter";

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/**
 * A member's Silver check on their admin page: where it stands, approving it
 * after a name or photo change, or taking it away (with a reason for the log).
 */
export function useAdminMemberCheckPresenter(userId: string, isAdmin: boolean) {
  const copy = MODERATION_COPY.memberCheck;
  // Kept with whom it was loaded for, so another member's page never shows it.
  const [loaded, setLoaded] = useState<{ userId: string; check: MemberCheckPM | null } | null>(
    null,
  );
  const [reloads, setReloads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !userId) return;
    let live = true;
    silverChecksAdminService.forMember(userId).then(
      (check) => {
        if (!live) return;
        setLoaded({ userId, check });
        setError(null);
      },
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [isAdmin, userId, reloads]);

  const check = loaded?.userId === userId ? loaded.check : null;

  const approve = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await silverChecksAdminService.approve(userId);
      setNotice(copy.approved);
      // The photos and account-age rules still apply: the API says what shows now.
      setReloads((n) => n + 1);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [busy, copy, userId]);

  const close = useCallback(() => {
    setRemoving(false);
    setReason("");
    setDialogError(null);
  }, []);

  const remove = useCallback(async () => {
    setBusy(true);
    setDialogError(null);
    try {
      await silverChecksAdminService.remove(userId, reason.trim());
      setNotice(copy.removed);
      setReloads((n) => n + 1);
      close();
    } catch (e) {
      setDialogError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [close, copy, reason, userId]);

  const dialog: AdminDialogVM | null = removing
    ? {
        title: copy.removeDialog.title,
        body: copy.removeDialog.body,
        confirmLabel: copy.removeDialog.confirm,
        cancelLabel: MODERATION_COPY.dialogs.cancel,
        destructive: true,
        reason: { label: copy.removeDialog.reasonLabel, value: reason, set: setReason },
        checkbox: null,
        typeToConfirm: null,
        canConfirm: !busy && reason.trim().length >= 3,
        busy,
        error: dialogError,
        confirm: () => void remove(),
        cancel: close,
      }
    : null;

  return {
    /** Null until loaded, and for a member without Silver: the section stays out of the way. */
    vm: check ? toMemberCheckVM(check, copy) : null,
    error,
    notice,
    busy,
    onApprove: () => void approve(),
    onRemove: () => {
      setNotice(null);
      setRemoving(true);
    },
    dialog,
    labels: { title: copy.title, approve: copy.approve, remove: copy.remove },
  };
}
