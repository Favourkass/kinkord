"use client";

import Link from "next/link";
import { Lock, User } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import WizardHeading from "@/components/auth/WizardHeading";
import TextField from "@/components/auth/TextField";
import GoldCta from "@/components/auth/GoldCta";
import CodeInput from "@/components/auth/CodeInput";
import { useLoginPresenter } from "@/presenters/useLoginPresenter";
import { Routes } from "@/constants/Routes";

export default function LoginPage() {
  const p = useLoginPresenter();

  return (
    <AuthShell>
      {!p.needsTwoFactor ? (
        <section className="w-full max-w-[640px] flex flex-col items-center gap-7">
          <WizardHeading plain="Log" highlight="In" sub="Welcome back to the community." />
          <form
            className="w-full flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void p.submit();
            }}
          >
            <TextField
              label="Email or username"
              icon={User}
              placeholder="you@example.com or @handle"
              autoComplete="username"
              value={p.identifier}
              onChange={p.setIdentifier}
            />
            <TextField
              label="Password"
              icon={Lock}
              type="password"
              autoComplete="current-password"
              value={p.password}
              onChange={p.setPassword}
            />
            <div className="-mt-2 text-right">
              <Link
                href={Routes.forgotPassword}
                className="text-[14px] font-semibold text-kink-gold underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            {p.error && <p className="text-[14px] text-red-400">{p.error}</p>}
            <GoldCta label="Log in" type="submit" loading={p.busy} />
          </form>
          <p className="text-[15px] text-kink-dim">
            New to Kinkord?{" "}
            <Link
              href={Routes.signup}
              className="font-semibold text-kink-gold underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </section>
      ) : (
        <section className="w-full max-w-[640px] flex flex-col items-center gap-7 text-center">
          <WizardHeading
            plain="Two-Factor"
            highlight="Authentication"
            sub="Enter the 6-digit code from your authenticator app."
          />
          <CodeInput value={p.code} onChange={p.setCode} />
          {p.error && <p className="text-[14px] text-red-400">{p.error}</p>}
          <GoldCta
            label="Verify"
            onClick={p.submitTwoFactor}
            loading={p.busy}
            className="max-w-[480px]"
          />
        </section>
      )}
    </AuthShell>
  );
}
