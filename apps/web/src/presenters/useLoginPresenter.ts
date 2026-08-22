"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/services/authClient";
import { Routes } from "@/constants/Routes";

/** Decides which Better Auth sign-in endpoint an identifier belongs to. */
export function identifierKind(identifier: string): "email" | "username" {
  return identifier.includes("@") && !identifier.startsWith("@") ? "email" : "username";
}

export function useLoginPresenter() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [code, setCode] = useState("");

  const submit = useCallback(async () => {
    if (!identifier.trim() || !password) {
      setError("Enter your email or username and your password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const kind = identifierKind(identifier.trim());
      const { data, error: err } =
        kind === "email"
          ? await authClient.signIn.email({ email: identifier.trim(), password })
          : await authClient.signIn.username({
              username: identifier.trim().replace(/^@/, "").toLowerCase(),
              password,
            });
      if (err) throw new Error(err.message ?? "Sign in failed");
      if ((data as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
        setNeedsTwoFactor(true);
        return;
      }
      router.push(Routes.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed. Check your details.");
    } finally {
      setBusy(false);
    }
  }, [identifier, password, router]);

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
      router.push(Routes.profile);
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
    busy,
    error,
    needsTwoFactor,
    code,
    setCode,
    submit,
    submitTwoFactor,
  };
}
