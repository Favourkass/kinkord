"use client";

import { useCallback, useEffect, useState } from "react";
import {
  attemptsMessage,
  verificationApi,
  verificationErrorMessage,
  type CodeSentPM,
  type VerificationChannel,
} from "@/services/verification.service";

export interface VerificationVM {
  /** Masked by the API once a code is out; null before that. */
  sentTo: string | null;
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
 * Shared verification flow for both contact points. Signup step 3 and
 * Settings → Security each drive it twice — once per channel — so the cooldown,
 * attempt messages and error wording are written once.
 */
export function useVerification(
  channel: VerificationChannel,
  onVerified?: () => void,
): VerificationVM {
  const [challenge, setChallenge] = useState<CodeSentPM | null>(null);
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

  const runSend = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const sent = await verificationApi.sendCode(channel);
      setChallenge(sent);
      setCode("");
      setResendIn(Math.ceil(sent.resendAfterMs / 1000));
    } catch (e) {
      setError(verificationErrorMessage(e, "Could not send the code. Try again."));
    } finally {
      setSending(false);
    }
  }, [channel]);

  const runVerify = useCallback(async () => {
    if (!challenge) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const result = await verificationApi.verify(channel, challenge.otpId, code);
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
      setError(verificationErrorMessage(e, "Could not check the code. Try again."));
    } finally {
      setVerifying(false);
    }
  }, [channel, challenge, code, onVerified]);

  // Stable identities: callers put these in effect dependency lists, and a fresh
  // function every render would re-fire the effect forever.
  const sendCode = useCallback(() => {
    void runSend();
  }, [runSend]);
  const verify = useCallback(() => {
    void runVerify();
  }, [runVerify]);

  return {
    sentTo: challenge?.sentTo ?? null,
    sent: challenge !== null,
    code,
    setCode,
    sendCode,
    verify,
    sending,
    verifying,
    error,
    resendIn,
    canResend: resendIn === 0 && !sending,
    verified,
  };
}
