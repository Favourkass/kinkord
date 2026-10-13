"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { VERIFICATION_COPY } from "@/constants/verification";
import {
  canStartVerification,
  failureReason,
  hasAttemptOpen,
  isSafeLaunchUrl,
  missingBeforeStart,
  needsSupportToVerify,
  photoSettling,
  type BronzeStatus,
  type BronzeVerificationPM,
} from "@/domain/bronzeVerification";
import { ApiError } from "@/services/apiClient";
import { bronzeVerificationApi } from "@/services/bronzeVerification.service";

/** Waits between status checks while Didit works: 15s, 30s, 60s, then every 2 minutes. */
const POLL_STEPS_MS = [15_000, 30_000, 60_000, 120_000];
const START_LABELS: Partial<Record<BronzeStatus, string>> = {
  failed: VERIFICATION_COPY.retry,
  outdated: VERIFICATION_COPY.reverify,
};
const TONES: Record<BronzeStatus, "neutral" | "good" | "warn" | "bad"> = {
  not_started: "neutral",
  pending: "neutral",
  manual_review: "neutral",
  verified: "good",
  failed: "warn",
  outdated: "warn",
  rejected: "bad",
  revoked: "bad",
};
// Looked up by whatever the API sends, which may be newer than this page.
const STATUSES: Partial<Record<string, { label: string; detail: string }>> =
  VERIFICATION_COPY.statuses;
const FAILURES: Partial<Record<string, string>> = VERIFICATION_COPY.failures;

/** Settings → Verification: consent, sending the member to Didit, status and withdrawal. */
export function useBronzeVerificationPresenter() {
  const router = useRouter();
  const copy = VERIFICATION_COPY;
  // Kept with when it was loaded, so "can start" never reads the clock while rendering.
  const [loaded, setLoaded] = useState<{ pm: BronzeVerificationPM; at: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<"start" | "resume" | "withdraw" | null>(null);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Moves on whenever a newer status is applied directly (a withdrawal), so a
  // status load already on its way can't overwrite it with older news.
  const applied = useRef(0);

  const handleAuth = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(Routes.login);
        return true;
      }
      return false;
    },
    [router],
  );

  useEffect(() => {
    let live = true;
    const since = applied.current;
    bronzeVerificationApi.status().then(
      (pm) => {
        if (!live || since !== applied.current) return;
        setLoaded({ pm, at: Date.now() });
        setLoadError(null);
      },
      (e: unknown) => {
        if (live && since === applied.current && !handleAuth(e)) setLoadError(copy.errors.load);
      },
    );
    return () => {
      live = false;
    };
  }, [copy.errors.load, handleAuth, version]);

  const status = loaded?.pm.status;
  // Didit's result can land any moment: check back while it's out, less often as
  // time goes on, and not at all while the tab is hidden.
  useEffect(() => {
    if (status !== "pending") return;
    let step = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        reload();
        step = Math.min(step + 1, POLL_STEPS_MS.length - 1);
        schedule();
      }, POLL_STEPS_MS[step]);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        clearTimeout(timer);
        return;
      }
      // Back on the page: look now, then slow down again from the start.
      step = 0;
      reload();
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reload, status]);

  // A just-uploaded photo can be checked a few minutes later; look again then.
  const photoReadyAt = loaded?.pm.photoReadyAt ?? null;
  useEffect(() => {
    if (!photoReadyAt) return;
    const wait = Math.max(0, new Date(photoReadyAt).getTime() - Date.now()) + 1_000;
    const timer = setTimeout(reload, Math.min(wait, 15 * 60_000));
    return () => clearTimeout(timer);
  }, [photoReadyAt, reload]);

  // Coming back from Didit with the browser's back button restores this page as it was left.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setBusy(null);
      reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [reload]);

  const pm = loaded?.pm ?? null;
  const consentText = pm ? (copy.consent[pm.policyVersion] ?? null) : null;
  const startable = loaded ? canStartVerification(loaded.pm, loaded.at) : false;
  const settling = loaded ? photoSettling(loaded.pm, loaded.at) : false;

  // Sends the member to Didit's hosted check, staying busy while the browser leaves.
  const goToDidit = useCallback(
    async (action: "start" | "resume", link: () => Promise<{ url: string }>) => {
      if (busy) return;
      setBusy(action);
      setActionError(null);
      setNotice(null);
      try {
        const { url } = await link();
        if (isSafeLaunchUrl(url)) {
          window.location.assign(url);
          return;
        }
        setActionError(copy.errors.badLink);
      } catch (e) {
        if (handleAuth(e)) return;
        // Nothing left to continue (it finished or expired): the fresh status says what's next.
        const nothingToResume = action === "resume" && e instanceof ApiError && e.status === 409;
        if (!nothingToResume)
          setActionError(e instanceof ApiError ? e.message : copy.errors[action]);
      }
      setBusy(null);
      reload();
    },
    [busy, copy.errors, handleAuth, reload],
  );

  const start = () => {
    if (!pm) return;
    void goToDidit("start", async () => {
      if (!pm.consented) await bronzeVerificationApi.consent(pm.policyVersion);
      return bronzeVerificationApi.start();
    });
  };

  const withdraw = useCallback(async () => {
    setBusy("withdraw");
    setActionError(null);
    try {
      const next = await bronzeVerificationApi.withdraw();
      applied.current += 1;
      setLoaded({ pm: next, at: Date.now() });
      setChecked(false);
      setConfirmingWithdraw(false);
      setNotice(copy.withdraw.done);
    } catch (e) {
      if (!handleAuth(e)) setActionError(e instanceof ApiError ? e.message : copy.errors.withdraw);
    } finally {
      setBusy(null);
    }
  }, [copy.errors.withdraw, copy.withdraw.done, handleAuth]);

  if (!pm)
    return {
      loading: !loadError,
      error: loadError
        ? {
            message: loadError,
            retryLabel: copy.retryLoad,
            onRetry: () => {
              setLoadError(null);
              reload();
            },
          }
        : null,
      view: null,
    };

  const resumable = pm.status === "pending" && pm.resumable;
  const state = resumable ? copy.unfinished : (STATUSES[pm.status] ?? copy.unknownStatus);
  const failure = failureReason(pm);
  const missing = missingBeforeStart(pm);
  const needsConsent = startable && !pm.consented;
  const startEnabled =
    startable && busy === null && (pm.consented || (checked && consentText !== null));
  // Why the start button is held, said under it (an out-of-date page says so above it).
  const startHint = startEnabled
    ? null
    : missing.length > 0
      ? copy.startHints.profile
      : settling
        ? copy.startHints.photo
        : needsConsent && consentText && !checked
          ? copy.startHints.consent
          : null;
  return {
    loading: false,
    error: null,
    view: {
      title: copy.title,
      intro: copy.intro,
      status: {
        heading: copy.statusHeading,
        label: state.label,
        detail: state.detail,
        failure: failure ? (FAILURES[failure] ?? copy.failures.other) : null,
        tone: TONES[pm.status] ?? "neutral",
      },
      attempts:
        pm.status === "failed" || pm.status === "not_started"
          ? copy.attemptsLeft(pm.attemptsRemaining)
          : null,
      badgeHint:
        pm.status === "verified"
          ? {
              text: copy.badgeHint,
              linkLabel: copy.badgeHintLink,
              href: Routes.profileEditPrivacy,
            }
          : null,
      // Only news to a member who could start; a verified member still sees their status.
      unavailable: !pm.available && hasAttemptOpen(pm) ? copy.unavailable : null,
      needs:
        missing.length > 0
          ? {
              heading: copy.needsHeading,
              text: copy.needs,
              items: missing.map((key) => copy.missing[key] ?? key),
              linkLabel: copy.editProfile,
              href: Routes.profileEdit,
            }
          : null,
      settling: pm.photoReadyAt
        ? copy.photoSettling(
            new Date(pm.photoReadyAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          )
        : null,
      checks: { heading: copy.checksHeading, items: copy.checks, note: copy.checksNote },
      privacy: { label: copy.privacyLink, href: pm.policyUrl || Routes.verificationPrivacy },
      consent:
        needsConsent && consentText ? { text: consentText, checked, onChange: setChecked } : null,
      outdatedPage: needsConsent && !consentText ? copy.outdatedPage : null,
      start: pm.available
        ? {
            label: busy === "start" ? copy.starting : (START_LABELS[pm.status] ?? copy.start),
            visible: hasAttemptOpen(pm),
            enabled: startEnabled,
            hint: startHint,
            onClick: start,
          }
        : null,
      resume: resumable
        ? {
            label: busy === "resume" ? copy.starting : copy.resume,
            enabled: busy === null,
            onClick: () => void goToDidit("resume", bronzeVerificationApi.resume),
          }
        : null,
      refresh:
        pm.status === "pending" || pm.status === "manual_review"
          ? { label: copy.refresh, onClick: reload }
          : null,
      withdraw: pm.withdrawable
        ? {
            label: copy.withdraw.button,
            onClick: () => {
              setActionError(null);
              setConfirmingWithdraw(true);
            },
          }
        : null,
      withdrawConfirm: confirmingWithdraw
        ? {
            title: copy.withdraw.title,
            body: copy.withdraw.body(needsSupportToVerify(pm)),
            confirmLabel: copy.withdraw.confirm,
            busyLabel: copy.withdraw.busy,
            cancelLabel: copy.withdraw.cancel,
            busy: busy === "withdraw",
            onConfirm: () => void withdraw(),
            onCancel: () => setConfirmingWithdraw(false),
          }
        : null,
      notice,
      actionError,
    },
  };
}
