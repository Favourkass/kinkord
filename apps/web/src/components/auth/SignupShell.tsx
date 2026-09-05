"use client";

import Link from "next/link";
import { BackChevronIcon } from "./AuthIcons";

interface SignupShellProps {
  step: number;
  totalSteps?: number;
  badge?: string;
  backHref?: string;
  onBack?: () => void;
  showTagline?: boolean;
  children: React.ReactNode;
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex w-full max-w-[340px] items-center lg:max-w-[890px]">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const filled = n <= step;
        return (
          <div key={n} className="flex flex-1 items-center last:flex-none">
            <span
              aria-current={n === step ? "step" : undefined}
              className={`grid size-6 shrink-0 place-items-center rounded-full border-2 border-kink-gold-bright text-[11px] font-black lg:size-12 lg:text-[20px] ${
                filled ? "bg-kink-gold-bright text-black" : "bg-black text-kink-cream"
              }`}
            >
              {n}
            </span>
            {n < total && <span className="h-px flex-1 bg-kink-cream lg:h-[2px]" />}
          </div>
        );
      })}
    </div>
  );
}

/** Signup wizard chrome per Figma 560-175: wordmark, tagline, progress dots, step badge. */
export default function SignupShell({
  step,
  totalSteps = 4,
  badge,
  backHref,
  onBack,
  showTagline = true,
  children,
}: SignupShellProps) {
  return (
    <div className="min-h-dvh bg-black">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center px-5 pb-10 pt-6 lg:max-w-[1220px] lg:pt-[52px]">
        {(backHref || onBack) &&
          (backHref ? (
            <Link
              href={backHref}
              aria-label="Back"
              className="absolute left-2 top-6 grid size-10 place-items-center text-kink-gold-bright lg:left-0 lg:top-[52px]"
            >
              <BackChevronIcon />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="absolute left-2 top-6 grid size-10 place-items-center text-kink-gold-bright lg:left-0 lg:top-[52px]"
            >
              <BackChevronIcon />
            </button>
          ))}
        <p className="text-center text-[32px] font-semibold tracking-[5px] text-kink-gold-bright lg:text-[65px]">
          KINKORD
        </p>
        {showTagline && (
          <p className="mt-1 text-center text-[11px] font-semibold tracking-[5px] text-kink-paper lg:text-[22px]">
            THE WORLD’S KINK COMMUNITY
          </p>
        )}
        <div className="mt-5 flex w-full justify-center lg:mt-8">
          <ProgressDots step={step} total={totalSteps} />
        </div>
        {badge && (
          <span className="mt-6 rounded-[5px] border-[1.5px] border-kink-gold-bright px-4 py-[7px] text-[11px] font-semibold tracking-[2px] text-kink-gold-bright lg:mt-8 lg:text-[20px]">
            {badge}
          </span>
        )}
        <div className="mt-5 flex w-full flex-1 flex-col items-center lg:mt-6 lg:max-w-[1130px]">
          {children}
        </div>
      </div>
    </div>
  );
}
