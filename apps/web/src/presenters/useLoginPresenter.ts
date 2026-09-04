"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/services/authClient";
import { api } from "@/services/apiClient";
import { classifyIdentifier } from "@/domain/identifier";
import { Routes } from "@/constants/Routes";

interface SignInOutcome {
  twoFactorRedirect?: boolean;
}

export function useLoginPresenter() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // Stay signed in by default (Facebook-style): the session cookie persists
  // across app closes so reopening lands on /home, not the login screen. Users
  // can still opt out (e.g. on a shared device) by unchecking "Remember me".
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [code, setCode] = useState("");

  const submit = useCallback(async () => {
    if (!identifier.trim() || !password) {
      setError("Enter your email, phone or username and your password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = classifyIdentifier(identifier);
      let outcome: SignInOutcome | null | undefined;
      if (id.kind === "phone") {
        outcome = await api.post<SignInOutcome>("/auth-ext/sign-in-phone", {
          phone: id.value,
          password,
          rememberMe,
        });
      } else {
        const { data, error: err } =
          id.kind === "email"
            ? await authClient.signIn.email({ email: id.value, password, rememberMe })
            : await authClient.signIn.username({ username: id.value, password, rememberMe });
        if (err) throw new Error(err.message ?? "Sign in failed");
        outcome = data as SignInOutcome | null;
      }
      if (outcome?.twoFactorRedirect) {
        setNeedsTwoFactor(true);
        return;
      }
      router.push(Routes.appHome);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed. Check your details.");
    } finally {
      setBusy(false);
    }
  }, [identifier, password, rememberMe, router]);

  const submitTwoFactor = useCallback(async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.twoFactor.verifyTotp({ code });
      if (err) throw new Error(err.message ?? "Invalid code");
      router.push(Routes.appHome);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code. Try again.");
    } finally {
      setBusy(false);
    }
  }, [code, router]);

  return {
    identifier,
    setIdentifier,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    busy,
    error,
    needsTwoFactor,
    code,
    setCode,
    submit,
    submitTwoFactor,
  };
}
