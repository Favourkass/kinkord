"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import {
  planDate,
  toAdminPaymentVM,
  type AdminPaymentPM,
  type PaymentStatus,
} from "@/domain/subscription";
import { paymentsAdminService } from "@/services/subscription.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";
import type { AdminDialogVM } from "./useAdminMemberPresenter";

const STATUSES: PaymentStatus[] = ["submitted", "verified", "rejected", "pending", "expired"];
const SEARCH_DELAY_MS = 300;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/**
 * The admins' payment queue: proofs to check against the bank statement,
 * found by the name on the sending account, then verified or rejected.
 */
export function useAdminPaymentsPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.payments;
  const [status, setStatus] = useState<PaymentStatus>("submitted");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  // Kept with what it was loaded for, so a switch never shows the wrong list.
  const [loaded, setLoaded] = useState<{ key: string; rows: AdminPaymentPM[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "verify" | "reject"; id: string } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [query]);

  const key = `${status}|${search}`;
  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    paymentsAdminService.list(status, search).then(
      (rows) => {
        if (!live) return;
        setLoaded({ key, rows });
        setError(null);
      },
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, key, search, status]);

  const current = loaded?.key === key ? loaded.rows : null;
  const rows = useMemo(
    () =>
      (current ?? []).map((pm) =>
        toAdminPaymentVM(pm, Routes.moderationMember, {
          noProof: copy.noProof,
          deletedAccount: copy.deletedAccount,
          periods: copy.periods,
          plan: copy.plan,
        }),
      ),
    [copy, current],
  );

  const close = useCallback(() => {
    setDialog(null);
    setReason("");
    setDialogError(null);
  }, []);

  const confirm = useCallback(async () => {
    if (!dialog) return;
    setBusy(true);
    setDialogError(null);
    try {
      if (dialog.kind === "verify") {
        const done = await paymentsAdminService.verify(dialog.id);
        setNotice(copy.verified(planDate(done.silverUntil)));
      } else {
        await paymentsAdminService.reject(dialog.id, reason.trim());
        setNotice(copy.rejected);
      }
      // Decided: it belongs to another list now.
      setLoaded((l) => l && { ...l, rows: l.rows.filter((r) => r.id !== dialog.id) });
      close();
    } catch (e) {
      setDialogError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [close, copy, dialog, reason]);

  const dialogVM: AdminDialogVM | null = dialog
    ? {
        title: dialog.kind === "verify" ? copy.verifyDialog.title : copy.rejectDialog.title,
        body: dialog.kind === "verify" ? copy.verifyDialog.body : copy.rejectDialog.body,
        confirmLabel:
          dialog.kind === "verify" ? copy.verifyDialog.confirm : copy.rejectDialog.confirm,
        cancelLabel: MODERATION_COPY.dialogs.cancel,
        destructive: dialog.kind === "reject",
        reason:
          dialog.kind === "reject"
            ? { label: copy.rejectDialog.reasonLabel, value: reason, set: setReason }
            : null,
        checkbox: null,
        typeToConfirm: null,
        canConfirm: !busy && (dialog.kind === "verify" || reason.trim().length >= 3),
        busy,
        error: dialogError,
        confirm: () => void confirm(),
        cancel: close,
      }
    : null;

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    statuses: STATUSES.map((value) => ({
      value,
      label: copy.statuses[value],
      active: value === status,
    })),
    setStatus: (s: PaymentStatus) => {
      setStatus(s);
      setNotice(null);
    },
    query,
    setQuery,
    loading: access.isAdmin && current === null && error === null,
    error,
    notice,
    empty: current !== null && current.length === 0,
    rows,
    askVerify: (id: string) => setDialog({ kind: "verify", id }),
    askReject: (id: string) => setDialog({ kind: "reject", id }),
    dialog: dialogVM,
    labels: {
      search: copy.search,
      loading: copy.loading,
      empty: copy.empty,
      expected: copy.expected,
      paid: copy.paid,
      amountDiffers: copy.amountDiffers,
      reference: copy.reference,
      theirReference: copy.theirReference,
      from: copy.from,
      member: copy.member,
      receipt: copy.receipt,
      noReceipt: copy.noReceipt,
      openReceipt: copy.openReceipt,
      reviewNote: copy.reviewNote,
      verify: copy.verify,
      reject: copy.reject,
    },
  };
}
