"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { VERIFICATION_COPY } from "@/constants/verification";
import {
  canStartVerification,
  hasAttemptOpen,
  isSafeLaunchUrl,
  type BronzeStatus,
  type BronzeVerificationPM,
} from "@/domain/bronzeVerification";
import { ApiError } from "@/services/apiClient";
import { bronzeVerificationApi } from "@/services/bronzeVerification.service";

const POLL_MS = 15_000;
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
  const [busy, setBusy] = useState<"start" | "withdraw" | null>(null);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

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
    bronzeVerificationApi.status().then(
      (pm) => {
        if (!live) return;
        setLoaded({ pm, at: Date.now() });
        setLoadError(null);
      },
      (e: unknown) => {
        if (live && !handleAuth(e)) setLoadError(copy.errors.load);
      },
    );
    return () => {
      live = false;
    };
  }, [copy.errors.load, handleAuth, version]);

  const status = loaded?.pm.status;
  // Didit's result can land any moment; check back while it's out.
  useEffect(() => {
    if (status !== "pending") return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
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

  const start = useCallback(async () => {
    if (!pm || busy) return;
    setBusy("start");
    setActionError(null);
    setNotice(null);
    try {
      if (!pm.consented) await bronzeVerificationApi.consent(pm.policyVersion);
      const launch = await bronzeVerificationApi.start();
      if (isSafeLaunchUrl(launch.url)) {
        // Stays busy while the browser leaves for Didit.
        window.location.assign(launch.url);
        return;
      }
      setActionError(copy.errors.badLink);
    } catch (e) {
      if (handleAuth(e)) return;
      setActionError(e instanceof ApiError ? e.message : copy.errors.start);
    }
    setBusy(null);
    reload();
  }, [busy, copy.errors.badLink, copy.errors.start, handleAuth, pm, reload]);

  const withdraw = useCallback(async () => {
    setBusy("withdraw");
    setActionError(null);
    try {
      const next = await bronzeVerificationApi.withdraw();
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

  if (!pm) return { loading: !loadError, error: loadError, view: null };

  const state = copy.statuses[pm.status];
  const needsConsent = startable && !pm.consented;
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
        tone: TONES[pm.status],
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
      unavailable: pm.available ? null : copy.unavailable,
      needs:
        pm.missing.length > 0
          ? {
              heading: copy.needsHeading,
              text: copy.needs,
              items: pm.missing.map((key) => copy.missing[key] ?? key),
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
            enabled:
              startable && busy === null && (pm.consented || (checked && consentText !== null)),
            onClick: () => void start(),
          }
        : null,
      refresh:
        pm.status === "pending" || pm.status === "manual_review"
          ? { label: copy.refresh, onClick: reload }
          : null,
      withdraw: pm.consented
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
            body: copy.withdraw.body,
            confirmLabel: copy.withdraw.confirm,
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
