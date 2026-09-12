"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SECURITY_COPY } from "@/constants/profileEdit";
import { Routes } from "@/constants/Routes";
import type { MePM } from "@/domain/profile";
import { ApiError } from "@/services/apiClient";
import { profileApi } from "@/services/profile.service";
import { useSecurityPresenter } from "./useProfilePresenter";

/**
 * Settings → Security & 2FA (moved off /profile; CEO 2026-09-12: "we still need to keep
 * the change password and co"). Wraps the TOTP + password flows in display-ready props.
 */
export function useSecurityPagePresenter() {
  const router = useRouter();
  const copy = SECURITY_COPY;
  const [me, setMe] = useState<MePM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorOn, setTwoFactorOn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const sec = useSecurityPresenter((enabled) => setTwoFactorOn(enabled));

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
      busy: sec.busy,
      error: sec.error,
      notice: sec.notice,
    },
  };
}
