"use client";

import { Check } from "lucide-react";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  error?: boolean;
}

/** Gold-bordered checkbox row used in the confirmation panel. */
export default function CheckRow({ checked, onChange, children, trailing, error }: Props) {
  return (
    <label className="flex w-full cursor-pointer items-center gap-4 py-4">
      <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onChange(!checked)}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition ${
          checked
            ? "border-kink-accent bg-kink-accent"
            : error
              ? "border-red-500/80"
              : "border-kink-accent bg-transparent"
        }`}
      >
        {checked && <Check size={18} strokeWidth={3.5} className="text-black" />}
      </span>
      <span className="flex-1 text-[15px] sm:text-[16px] leading-relaxed text-kink-cream">
        {children}
      </span>
      {trailing && <span className="shrink-0 text-kink-gold">{trailing}</span>}
    </label>
  );
}
