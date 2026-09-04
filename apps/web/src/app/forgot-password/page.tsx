"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import WizardHeading from "@/components/auth/WizardHeading";
import TextField from "@/components/auth/TextField";
import GoldCta from "@/components/auth/GoldCta";
import AgePill from "@/components/ui/AgePill";
import { useForgotPasswordPresenter } from "@/presenters/usePasswordResetPresenter";
import { Routes } from "@/constants/Routes";

export default function ForgotPasswordPage() {
  const p = useForgotPasswordPresenter();

  return (
    <AuthShell>
      <section className="w-full max-w-[640px] flex flex-col items-center gap-7 text-center">
        <WizardHeading
          plain="Reset Your"
          highlight="Password"
          sub="Enter your email and we'll send you a reset link."
        />
        {p.sent ? (
          <div className="w-full rounded-2xl border border-kink-amber/60 bg-kink-surface px-6 py-8">
            <p className="text-[17px] text-kink-cream">
              📬 If that email is registered, a{" "}
              <span className="text-kink-gold font-semibold">reset link</span> is on its way. Check
              your inbox (and spam).
            </p>
          </div>
        ) : (
          <form
            className="w-full flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void p.submit();
            }}
          >
            <TextField
              label="Email address"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={p.email}
              onChange={p.setEmail}
              error={p.error ?? undefined}
            />
            <GoldCta label="Send reset link" type="submit" loading={p.busy} />
          </form>
        )}
        <div className="w-full max-w-[354px]">
          <AgePill lead="18+ Only." rest="You must be 18 or older to use Kinkord." compact />
        </div>
        <Link
          href={Routes.login}
          className="text-[15px] font-semibold text-kink-gold underline-offset-4 hover:underline"
        >
          Back to log in
        </Link>
      </section>
    </AuthShell>
  );
}
