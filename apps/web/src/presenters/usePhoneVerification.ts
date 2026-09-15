"use client";

import { useCallback, useEffect, useState } from "react";
import {
  attemptsMessage,
  phoneErrorMessage,
  phoneVerificationApi,
  type PhoneCodeSentPM,
} from "@/services/phoneVerification.service";

export interface PhoneVerificationVM {
  /** Masked by the API once a code is out; null before that. */
  phone: string | null;
  sent: boolean;
  code: string;
  setCode: (code: string) => void;
  sendCode: () => void;
  verify: () => void;
  sending: boolean;
  verifying: boolean;
  error: string | null;
  resendIn: number;
  canResend: boolean;
  verified: boolean;
}

/**
 * Shared phone-verification flow: signup step 3 and Settings → Security both
 * drive the same two endpoints, so the cooldown, attempt messages and error
 * wording live here rather than being written twice.
 */
export function usePhoneVerification(onVerified?: () => void): PhoneVerificationVM {
  const [challenge, setChallenge] = useState<PhoneCodeSentPM | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [verified, setVerified] = useState(false);

  /** Mirrors the cooldown the API enforces, so the link is not dead on arrival. */
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const sent = await phoneVerificationApi.sendCode();
      setChallenge(sent);
      setCode("");
      setResendIn(Math.ceil(sent.resendAfterMs / 1000));
    } catch (e) {
      setError(phoneErrorMessage(e, "Could not send the code. Try again."));
    } finally {
      setSending(false);
    }
  }, []);

  const verify = useCallback(async () => {
    if (!challenge) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const result = await phoneVerificationApi.verify(challenge.otpId, code);
      if (result.verified) {
        setVerified(true);
        onVerified?.();
        return;
      }
      setCode("");
      setError(
        attemptsMessage(result.attemptsLeft) ??
          "That code is wrong or has expired. Send a new one.",
      );
    } catch (e) {
      setError(phoneErrorMessage(e, "Could not check the code. Try again."));
    } finally {
      setVerifying(false);
    }
  }, [challenge, code, onVerified]);

  return {
    phone: challenge?.sentTo ?? null,
    sent: challenge !== null,
    code,
    setCode,
    sendCode: () => {
      void sendCode();
    },
    verify: () => {
      void verify();
    },
    sending,
    verifying,
    error,
    resendIn,
    canResend: resendIn === 0 && !sending,
    verified,
  };
}
