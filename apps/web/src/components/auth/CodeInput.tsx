"use client";

import { useRef } from "react";

interface Props {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label?: string;
}

/** Six separate code boxes with auto-advance and paste support. */
export default function CodeInput({ length = 6, value, onChange, disabled, label }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setChar = (i: number, ch: string) => {
    const chars = value.padEnd(length, " ").split("");
    chars[i] = ch || " ";
    onChange(chars.join("").trimEnd().replace(/ /g, ""));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <p className="text-[18px] sm:text-[20px] text-kink-cream">{label}</p>}
      <div
        className="flex gap-2.5 sm:gap-3.5"
        role="group"
        aria-label={label ?? "Verification code"}
      >
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={1}
            disabled={disabled}
            value={value[i] ?? ""}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => {
              const ch = e.target.value.replace(/\D/g, "").slice(-1);
              setChar(i, ch);
              if (ch && i < length - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
            }}
            onPaste={(e) => {
              e.preventDefault();
              const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
              if (digits) {
                onChange(digits);
                refs.current[Math.min(digits.length, length - 1)]?.focus();
              }
            }}
            className="h-14 w-11 sm:h-16 sm:w-14 rounded-xl border-2 border-kink-amber/80 bg-transparent text-center text-2xl font-bold text-kink-gold outline-none transition focus:border-kink-gold disabled:opacity-40"
          />
        ))}
      </div>
    </div>
  );
}
