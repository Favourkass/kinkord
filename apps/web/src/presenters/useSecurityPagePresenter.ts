"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SECURITY_COPY } from "@/constants/profileEdit";
import { Routes } from "@/constants/Routes";
import type { MePM, OwnProfilePM } from "@/domain/profile";
import { ApiError } from "@/services/apiClient";
import { profileApi } from "@/services/profile.service";
import { usePhoneVerification } from "./usePhoneVerification";
import { useSecurityPresenter } from "./useProfilePresenter";

/**
 * Settings → Security & 2FA (moved off /profile; CEO 2026-09-12: "we still need to keep
 * the change password and co"). Wraps the TOTP + password flows in display-ready props.
 */
export function useSecurityPagePresenter() {
  const router = useRouter();
  const copy = SECURITY_COPY;
  const [me, setMe] = useState<MePM | null>(null);
  const [profile, setProfile] = useState<OwnProfilePM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorOn, setTwoFactorOn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const sec = useSecurityPresenter((enabled) => setTwoFactorOn(enabled));

  const phone = usePhoneVerification();

  useEffect(() => {
    let cancelled = false;
    void profileApi
      .own()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // The phone card falls back to "add a number" if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void profileApi
      .me()
      .then((m) => {
        if (!cancelled) setMe(m);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setError(copy.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, copy.loadError]);

  const on = twoFactorOn ?? me?.twoFactorEnabled ?? false;
  const tf = copy.twoFactor;

  return {
    loading,
    error,
    view: {
      title: copy.title,
      subtitle: copy.subtitle,
      twoFactor: {
        heading: tf.heading,
        on,
        statusLabel: on ? tf.on : tf.off,
        description: tf.description,
        passwordLabel: on ? tf.passwordToDisable : tf.passwordToEnable,
        password,
        onPassword: setPassword,
        actionLabel: on ? tf.disable : tf.enable,
        onAction: () => {
          void (on ? sec.disable(password) : sec.beginEnable(password));
        },
        setup: sec.setup
          ? {
              instructions: tf.instructions,
              qrDataUrl: sec.setup.qrDataUrl,
              qrAlt: tf.qrAlt,
              backupTitle: tf.backupCodes,
              backupCodes: sec.setup.backupCodes,
              code: sec.code,
              onCode: sec.setCode,
              confirmLabel: tf.confirm,
              onConfirm: () => {
                void sec.confirmEnable();
              },
            }
          : null,
      },
      password: {
        heading: copy.password.heading,
        currentLabel: copy.password.current,
        nextLabel: copy.password.next,
        helper: copy.password.helper,
        current: pw.current,
        next: pw.next,
        onCurrent: (v: string) => setPw((s) => ({ ...s, current: v })),
        onNext: (v: string) => setPw((s) => ({ ...s, next: v })),
        submitLabel: copy.password.submit,
        onSubmit: () => {
          void sec.changePassword(pw.current, pw.next);
        },
      },
      phone: {
        heading: copy.phone.heading,
        // Optimistic once verified in this session; the profile row is already updated.
        verified: phone.verified || (profile?.phoneVerified ?? false),
        statusLabel:
          phone.verified || profile?.phoneVerified ? copy.phone.verified : copy.phone.unverified,
        hasNumber: Boolean(profile?.phone),
        number: profile?.phone ?? null,
        description: copy.phone.description,
        verifiedNote: copy.phone.verifiedNote,
        missingNote: copy.phone.missing,
        sentNote: phone.phone ? copy.phone.sentTo(phone.phone) : null,
        sendLabel: phone.sent ? copy.phone.resend : copy.phone.send,
        onSend: phone.sendCode,
        canSend: phone.canResend && Boolean(profile?.phone),
        cooldownLabel:
          phone.resendIn > 0
            ? copy.phone.resendIn(
                `${String(Math.floor(phone.resendIn / 60)).padStart(2, "0")}:${String(
                  phone.resendIn % 60,
                ).padStart(2, "0")}`,
              )
            : null,
        sending: phone.sending,
        sent: phone.sent,
        codeLabel: copy.phone.codeLabel,
        code: phone.code,
        onCode: phone.setCode,
        submitLabel: copy.phone.submit,
        onSubmit: phone.verify,
        verifying: phone.verifying,
        error: phone.error,
      },
      busy: sec.busy,
      error: sec.error,
      notice: sec.notice,
    },
  };
}
