"use client";

import { useCallback, useState } from "react";
import { authClient } from "@/services/authClient";
import { Routes } from "@/constants/Routes";

export function useForgotPasswordPresenter() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}${Routes.resetPassword}`,
      });
      setSent(true);
    } catch {
      // Same response either way: never reveal whether an email exists.
      setSent(true);
    } finally {
      setBusy(false);
    }
  }, [email]);

  return { email, setEmail, busy, sent, error, submit };
}

export function useResetPasswordPresenter(token: string | null) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError("Use at least 10 characters with letters and numbers.");
      return;
    }
    if (confirm !== password) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("This reset link is invalid or expired. Request a new one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.resetPassword({ newPassword: password, token });
      if (err) throw new Error(err.message ?? "Reset failed");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This link may have expired. Request a new one.");
    } finally {
      setBusy(false);
    }
  }, [password, confirm, token]);

  return { password, setPassword, confirm, setConfirm, busy, done, error, submit };
}
