"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { toAdminVerificationReviewVM, type AdminVerificationReviewPM } from "@/domain/moderation";
import { moderationService } from "@/services/moderation.service";
import type { AdminDialogVM } from "./useAdminMemberPresenter";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

type Decision = "approve" | "reject";

/** What the API requires of a decision; checked here so the button says so first. */
const MIN_EVIDENCE = 3;
const MIN_REASON = 10;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** Moderation → Verification: identity checks waiting for an admin's decision. */
export function useAdminVerificationPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.verification;
  const [reviews, setReviews] = useState<AdminVerificationReviewPM[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [pending, setPending] = useState<{ id: string; decision: Decision } | null>(null);
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    moderationService.verificationReviews().then(
      (rows) => {
        if (!live) return;
        setReviews(rows);
        setLoadError(null);
      },
      (e: unknown) => live && setLoadError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, version]);

  const rows = useMemo(
    () =>
      (reviews ?? []).map((pm) =>
        toAdminVerificationReviewVM(pm, Routes.moderationMember, {
          noName: copy.noName,
          checks: copy.checks,
          reasons: copy.reasons,
        }),
      ),
    [copy.checks, copy.noName, copy.reasons, reviews],
  );

  const open = useCallback(
    (id: string, decision: Decision) => {
      const review = reviews?.find((r) => r.id === id);
      if (!review) return;
      setPending({ id, decision });
      // The Didit session is the usual evidence; the admin can replace it.
      setEvidence(`didit:${review.providerSessionId}`);
      setReason("");
      setDialogError(null);
      setNotice(null);
    },
    [reviews],
  );

  const cancel = useCallback(() => {
    if (!busy) setPending(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    setDialogError(null);
    try {
      await moderationService.decideVerification(pending.id, {
        decision: pending.decision,
        evidenceReference: evidence.trim(),
        reason: reason.trim(),
      });
      setReviews((list) => list && list.filter((r) => r.id !== pending.id));
      setNotice(pending.decision === "approve" ? copy.notices.approved : copy.notices.rejected);
      setPending(null);
    } catch (e) {
      setDialogError(messageOf(e));
      // Closed by someone else, or the member changed something: show the queue as it is now.
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }, [copy.notices, evidence, pending, reason]);

  const dialog = useMemo((): AdminDialogVM | null => {
    if (!pending) return null;
    const approve = pending.decision === "approve";
    const d = copy.decision;
    return {
      title: approve ? d.approveTitle : d.rejectTitle,
      body: approve ? d.approveBody : d.rejectBody,
      confirmLabel: approve ? copy.approve : copy.reject,
      cancelLabel: MODERATION_COPY.dialogs.cancel,
      destructive: !approve,
      input: { label: d.evidenceLabel, value: evidence, set: setEvidence },
      reason: { label: d.reasonLabel, value: reason, set: setReason },
      checkbox: null,
      typeToConfirm: null,
      canConfirm:
        !busy && evidence.trim().length >= MIN_EVIDENCE && reason.trim().length >= MIN_REASON,
      busy,
      error: dialogError,
      confirm: () => void confirm(),
      cancel,
    };
  }, [busy, cancel, confirm, copy, dialogError, evidence, pending, reason]);

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    loading: access.isAdmin && reviews === null && loadError === null,
    error: loadError,
    empty: reviews !== null && reviews.length === 0,
    rows,
    notice,
    dialog,
    onApprove: (id: string) => open(id, "approve"),
    onReject: (id: string) => open(id, "reject"),
    onRefresh: () => setVersion((v) => v + 1),
    labels: {
      intro: copy.intro,
      loading: copy.loading,
      empty: copy.empty,
      refresh: MODERATION_COPY.verification.refresh,
      openMember: copy.openMember,
      photo: copy.photo,
      original: copy.original,
      session: copy.session,
      why: copy.why,
      checksHeading: copy.checksHeading,
      passed: copy.passed,
      notPassed: copy.notPassed,
      approve: copy.approve,
      reject: copy.reject,
      cannotApprove: copy.cannotApprove,
    },
  };
}
