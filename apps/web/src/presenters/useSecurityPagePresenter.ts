"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SECURITY_COPY } from "@/constants/profileEdit";
import { Routes } from "@/constants/Routes";
import type { MePM, OwnProfilePM } from "@/domain/profile";
import { ApiError } from "@/services/apiClient";
import { profileApi } from "@/services/profile.service";
import { saveSettingsPhone } from "@/services/phoneSettings.service";
import { backupCodesText, groupedKey } from "@/services/two-factor.service";
import { useVerification } from "./useVerification";
import { useSecurityPresenter } from "./useProfilePresenter";

/** How long a copy button says "Copied". */
const COPIED_MS = 2000;

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

  /** Which value was just copied, so its button says so for a moment. */
  const [copied, setCopied] = useState<"key" | "codes" | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );
  const copyValue = useCallback(async (target: "key" | "codes", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // No clipboard here (an old browser, an insecure page): the text can still be selected.
    }
    setCopied(target);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), COPIED_MS);
  }, []);

  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaveError, setPhoneSaveError] = useState<string | null>(null);
  const phone = useVerification("phone");
  const savePhone = async () => {
    if (savingPhone) return;
    setSavingPhone(true);
    setPhoneSaveError(null);
    try {
      const saved = await saveSettingsPhone(phoneDraft);
      setProfile(saved);
      phone.reset();
      setPhoneDraft("");
    } catch (e) {
      setPhoneSaveError(e instanceof Error ? e.message : "Could not save your number. Try again.");
    } finally {
      setSavingPhone(false);
    }
  };
  const emailCode = useVerification("email");

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
              samePhone: tf.samePhone,
              openAppLabel: tf.openApp,
              openAppHref: sec.setup.uri,
              setupKeyLabel: tf.setupKey,
              setupKey: sec.setup.key ? groupedKey(sec.setup.key) : null,
              copyKeyLabel: copied === "key" ? tf.copied : tf.copyKey,
              onCopyKey: () => {
                const key = sec.setup?.key;
                if (key) void copyValue("key", key);
              },
              backupTitle: tf.backupCodes,
              backupCodes: sec.setup.backupCodes,
              copyCodesLabel: copied === "codes" ? tf.copied : tf.copyCodes,
              onCopyCodes: () => {
                const codes = sec.setup?.backupCodes ?? [];
                if (codes.length) void copyValue("codes", backupCodesText(codes));
              },
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
        entry: {
          label: copy.phone.inputLabel,
          placeholder: copy.phone.placeholder,
          value: phoneDraft,
          onChange: setPhoneDraft,
          saveLabel: copy.phone.save,
          onSave: () => void savePhone(),
          saving: savingPhone,
          error: phoneSaveError,
        },
        sentNote: phone.sentTo ? copy.phone.sentTo(phone.sentTo) : null,
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
      email: {
        heading: copy.email.heading,
        verified: emailCode.verified || (me?.emailVerified ?? false),
        statusLabel:
          emailCode.verified || me?.emailVerified ? copy.email.verified : copy.email.unverified,
        description: copy.email.description,
        verifiedNote: copy.email.verifiedNote,
        sentNote: emailCode.sentTo ? copy.email.sentTo(emailCode.sentTo) : null,
        sendLabel: emailCode.sent ? copy.email.resend : copy.email.send,
        onSend: emailCode.sendCode,
        canSend: emailCode.canResend,
        cooldownLabel:
          emailCode.resendIn > 0
            ? copy.email.resendIn(
                `${String(Math.floor(emailCode.resendIn / 60)).padStart(2, "0")}:${String(
                  emailCode.resendIn % 60,
                ).padStart(2, "0")}`,
              )
            : null,
        sending: emailCode.sending,
        sent: emailCode.sent,
        codeLabel: copy.email.codeLabel,
        code: emailCode.code,
        onCode: emailCode.setCode,
        submitLabel: copy.email.submit,
        onSubmit: emailCode.verify,
        verifying: emailCode.verifying,
        error: emailCode.error,
      },
      busy: sec.busy,
      error: sec.error,
      notice: sec.notice,
    },
  };
}
