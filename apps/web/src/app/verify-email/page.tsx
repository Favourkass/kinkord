"use client";

import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import WizardHeading from "@/components/auth/WizardHeading";
import GoldCta from "@/components/auth/GoldCta";
import { Routes } from "@/constants/Routes";

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <section className="w-full max-w-[640px] flex flex-col items-center gap-7 text-center">
        <WizardHeading plain="Email" highlight="Verified" />
        <div className="w-full rounded-2xl border border-kink-amber/60 bg-kink-surface px-6 py-8">
          <p className="text-[17px] text-kink-cream">
            ✅ Your email address is confirmed. You&apos;re signed in.
          </p>
        </div>
        <Link href={Routes.profile} className="w-full max-w-[480px]">
          <GoldCta label="Go to my profile" />
        </Link>
      </section>
    </AuthShell>
  );
}
