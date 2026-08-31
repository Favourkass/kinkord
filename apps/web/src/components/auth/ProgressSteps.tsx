"use client";

interface Props {
  current: number; // 1-based
  count: number;
}

/** Numbered wizard dots joined by a hairline, per the Figma onboarding frames. */
export default function ProgressSteps({ current, count }: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center">
        {Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          const active = n <= current;
          return (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div
                aria-current={n === current ? "step" : undefined}
                className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border-2 text-[15px] font-bold ${
                  active
                    ? "bg-kink-accent border-kink-accent text-black"
                    : "border-kink-gold/80 text-kink-cream/90"
                }`}
              >
                {n}
              </div>
              {n < count && <div className="mx-1 h-px flex-1 bg-kink-cream/25" />}
            </div>
          );
        })}
      </div>
      <span className="rounded-md border border-kink-gold/60 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-kink-gold">
        STEP {current} OF {count}
      </span>
    </div>
  );
}
