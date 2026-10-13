"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import {
  canDecideVerification,
  clockTime,
  isTwoFactorCode,
  stepUpMessage,
  stepUpRefusal,
  stepUpRemainingMs,
  toAdminVerificationReviewVM,
  twoFactorCodeInput,
  type AdminVerificationReviewPM,
} from "@/domain/moderation";
import { ApiError } from "@/services/apiClient";
import { moderationService } from "@/services/moderation.service";
import type { AdminDialogVM } from "./useAdminMemberPresenter";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

type Decision = "approve" | "reject";

const copy = MODERATION_COPY.verification;
const STEP_UP_LABELS = { expired: copy.stepUp.expired, retryAt: copy.stepUp.retryAt };
const REVIEW_LABELS = {
  noName: copy.noName,
  checks: copy.checks,
  reasons: copy.reasons,
  own: copy.own,
  protected: copy.protected,
  duplicateOf: copy.duplicateOf,
  idChecksFailed: copy.cannotApprove,
  identityElsewhere: copy.identityElsewhere,
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** Moderation → Verification: identity checks waiting for an admin's decision. */
export function useAdminVerificationPresenter() {
  const access = useAdminAccessPresenter();
  const [reviews, setReviews] = useState<AdminVerificationReviewPM[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  /** When this session's 2FA confirmation lapses, on this device's clock; null asks for a code. */
  const [confirmedUntil, setConfirmedUntil] = useState<number | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  const [pending, setPending] = useState<{ id: string; decision: Decision } | null>(null);
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const confirmed = confirmedUntil !== null;

  /** Back to the code prompt when the API wants one; a decision in progress waits behind it. */
  const askAgain = useCallback((e: unknown): boolean => {
    const refusal = e instanceof ApiError ? stepUpRefusal(e.status, e.body) : null;
    if (refusal?.kind !== "required" && refusal?.kind !== "twoFactorOff") return false;
    setConfirmedUntil(null);
    setStepUpError(stepUpMessage(refusal, messageOf(e), STEP_UP_LABELS));
    return true;
  }, []);

  useEffect(() => {
    if (!access.isAdmin || !confirmed) return;
    let live = true;
    moderationService.verificationReviews().then(
      (rows) => {
        if (!live) return;
        setReviews(rows);
        setLoadError(null);
      },
      (e: unknown) => {
        if (live && !askAgain(e)) setLoadError(messageOf(e));
      },
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, askAgain, confirmed, version]);

  // Ask for a new code as the confirmation lapses, rather than letting the next call fail.
  useEffect(() => {
    if (confirmedUntil === null) return;
    const timer = setTimeout(
      () => {
        setConfirmedUntil(null);
        setStepUpError(copy.stepUp.expired);
      },
      Math.max(0, confirmedUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [confirmedUntil]);

  const confirmStepUp = useCallback(async () => {
    if (!isTwoFactorCode(stepUpCode) || stepUpBusy) return;
    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const { verifiedUntil } = await moderationService.stepUpVerification(stepUpCode);
      setStepUpCode("");
      // Read the queue afresh: its photo links lapse with the confirmation.
      setReviews(null);
      setConfirmedUntil(Date.now() + stepUpRemainingMs(verifiedUntil));
    } catch (e) {
      const refusal = e instanceof ApiError ? stepUpRefusal(e.status, e.body) : null;
      setStepUpError(refusal ? stepUpMessage(refusal, messageOf(e), STEP_UP_LABELS) : messageOf(e));
      // A refused code can't be used again; leave the box ready for the next one.
      if (refusal) setStepUpCode("");
    } finally {
      setStepUpBusy(false);
    }
  }, [stepUpBusy, stepUpCode]);

  const rows = useMemo(
    () =>
      (reviews ?? []).map((pm) =>
        toAdminVerificationReviewVM(pm, Routes.moderationMember, REVIEW_LABELS),
      ),
    [reviews],
  );

  const open = useCallback(
    (id: string, decision: Decision) => {
      const review = reviews?.find((r) => r.id === id);
      // Their own, or an admin's for a non-founder: the API refuses, so there's nothing to open.
      if (!review || review.own || review.protected) return;
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
      if (askAgain(e)) return;
      setDialogError(messageOf(e));
      // Closed elsewhere, or something changed since it opened: show the queue as it is now.
      if (e instanceof ApiError && e.status === 409) setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }, [askAgain, evidence, pending, reason]);

  const dialog = useMemo((): AdminDialogVM | null => {
    // While a new code is needed (or the queue is being read again), the decision waits.
    if (!pending || !confirmed || reviews === null) return null;
    const approve = pending.decision === "approve";
    const d = copy.decision;
    // Gone from the queue as read now: someone closed it, so there's nothing left to decide.
    const stillOpen = reviews.some((r) => r.id === pending.id);
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
      canConfirm: stillOpen && !busy && canDecideVerification({ evidence, reason }),
      busy,
      error: dialogError ?? (stillOpen ? null : copy.gone),
      confirm: () => void confirm(),
      cancel,
    };
  }, [busy, cancel, confirm, confirmed, dialogError, evidence, pending, reason, reviews]);

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    loading: access.isAdmin && confirmed && reviews === null && loadError === null,
    error: loadError,
    empty: reviews !== null && reviews.length === 0,
    rows,
    notice,
    dialog,
    confirmedUntil:
      confirmedUntil === null ? null : copy.confirmedUntil(clockTime(confirmedUntil) ?? ""),
    stepUp:
      access.isAdmin && !confirmed
        ? {
            title: copy.stepUp.title,
            body: copy.stepUp.body,
            label: copy.stepUp.label,
            action: stepUpBusy ? copy.stepUp.confirming : copy.stepUp.action,
            code: stepUpCode,
            setCode: (value: string) => setStepUpCode(twoFactorCodeInput(value)),
            submit: () => void confirmStepUp(),
            canSubmit: isTwoFactorCode(stepUpCode) && !stepUpBusy,
            busy: stepUpBusy,
            error: stepUpError,
            hint: copy.stepUp.noTwoFactor,
            security: { label: copy.stepUp.securityLink, href: Routes.settingsSecurity },
          }
        : null,
    onApprove: (id: string) => open(id, "approve"),
    onReject: (id: string) => open(id, "reject"),
    onRefresh: () => setVersion((v) => v + 1),
    labels: {
      intro: copy.intro,
      loading: copy.loading,
      empty: copy.empty,
      refresh: copy.refresh,
      openMember: copy.openMember,
      photo: copy.photo,
      original: copy.original,
      closePhoto: copy.closePhoto,
      session: copy.session,
      why: copy.why,
      checksHeading: copy.checksHeading,
      passed: copy.passed,
      notPassed: copy.notPassed,
      approve: copy.approve,
      reject: copy.reject,
    },
  };
}
