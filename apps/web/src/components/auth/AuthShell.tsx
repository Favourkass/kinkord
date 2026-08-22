"use client";

import Image from "next/image";
import ProgressSteps from "./ProgressSteps";

interface Props {
  /** 1-based current wizard step; omit for non-wizard screens (login etc.) */
  step?: number;
  stepCount?: number;
  showBack?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}

/** Dark centered column used by every auth/onboarding screen. */
export default function AuthShell({ step, stepCount = 5, showBack, onBack, children }: Props) {
  return (
    <main className="min-h-screen bg-kink-ink text-kink-cream flex flex-col items-center px-5 pb-16 pt-10 sm:pt-14">
      <div className="w-full max-w-[880px] flex flex-col items-center">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="self-start -mb-8 text-kink-cream/80 hover:text-kink-gold text-2xl leading-none"
          >
            ←
          </button>
        )}

        <h1
          className="flex items-end text-kink-amber font-black tracking-[0.08em] text-[34px] sm:text-[40px] leading-none select-none"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          KINK
          <Image
            src="/brand/key.png"
            alt="O"
            width={34}
            height={35}
            className="mx-[1px] mb-[1px] h-[0.82em] w-auto"
            priority
          />
          RD
        </h1>
        <p className="mt-2 text-[11px] sm:text-[13px] tracking-[0.35em] text-kink-cream/90 uppercase">
          The World&apos;s Kink Community
        </p>

        {step ? (
          <div className="mt-8 w-full max-w-[560px]">
            <ProgressSteps current={step} count={stepCount} />
          </div>
        ) : null}

        <div className="mt-8 w-full flex flex-col items-center">{children}</div>
      </div>
    </main>
  );
}
