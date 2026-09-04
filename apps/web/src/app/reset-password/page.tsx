"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import WizardHeading from "@/components/auth/WizardHeading";
import TextField from "@/components/auth/TextField";
import GoldCta from "@/components/auth/GoldCta";
import AgePill from "@/components/ui/AgePill";
import { useResetPasswordPresenter } from "@/presenters/usePasswordResetPresenter";
import { Routes } from "@/constants/Routes";

function ResetPasswordInner() {
  const token = useSearchParams().get("token");
  const p = useResetPasswordPresenter(token);

  return (
    <section className="w-full max-w-[640px] flex flex-col items-center gap-7 text-center">
      <WizardHeading plain="Choose a New" highlight="Password" />
      {p.done ? (
        <>
          <div className="w-full rounded-2xl border border-kink-amber/60 bg-kink-surface px-6 py-8">
            <p className="text-[17px] text-kink-cream">✅ Password updated. You can log in now.</p>
          </div>
          <Link href={Routes.login} className="w-full max-w-[480px]">
            <GoldCta label="Go to log in" />
          </Link>
        </>
      ) : (
        <form
          className="w-full flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void p.submit();
          }}
        >
          <TextField
            label="New password"
            icon={Lock}
            type="password"
            autoComplete="new-password"
            value={p.password}
            onChange={p.setPassword}
            helper="Use 10+ characters with letters & numbers."
          />
          <TextField
            label="Confirm new password"
            icon={Lock}
            type="password"
            autoComplete="new-password"
            value={p.confirm}
            onChange={p.setConfirm}
          />
          {p.error && <p className="text-[14px] text-red-400">{p.error}</p>}
          <GoldCta label="Reset password" type="submit" loading={p.busy} />
        </form>
      )}
      <div className="w-full max-w-[354px]">
        <AgePill lead="18+ Only." rest="You must be 18 or older to use Kinkord." compact />
      </div>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <ResetPasswordInner />
      </Suspense>
    </AuthShell>
  );
}
