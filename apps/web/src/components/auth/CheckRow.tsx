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
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border-2 transition lg:h-7 lg:w-7 ${
          checked
            ? "border-kink-gold-bright bg-kink-gold-bright"
            : error
              ? "border-red-500/80"
              : "border-kink-gold-bright bg-transparent"
        }`}
      >
        {checked && <Check size={16} strokeWidth={3.5} className="text-black" />}
      </span>
      <span className="flex-1 text-[13px] font-semibold leading-relaxed text-kink-cream lg:text-[17px]">
        {children}
      </span>
      {trailing && <span className="shrink-0 text-kink-gold">{trailing}</span>}
    </label>
  );
}
