"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, CheckCircle2, type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "password";
  placeholder?: string;
  helper?: string;
  error?: string;
  valid?: boolean;
  icon?: LucideIcon;
  autoComplete?: string;
  leftAddon?: React.ReactNode;
}

/** Dark input with label, helper, validity tick / password eye, per Figma. */
export default function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  helper,
  error,
  valid,
  icon: Icon,
  autoComplete,
  leftAddon,
}: Props) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const inputType = type === "password" && reveal ? "text" : type;

  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-kink-cream">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 rounded-xl border bg-kink-surface px-4 py-[13px] transition focus-within:border-kink-gold ${
          error ? "border-red-500/70" : "border-kink-line"
        }`}
      >
        {Icon && <Icon size={18} className="shrink-0 text-kink-gold" aria-hidden />}
        {leftAddon}
        <input
          id={id}
          type={inputType}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[16px] text-kink-cream placeholder:text-kink-faint outline-none"
        />
        {type === "password" ? (
          <button
            type="button"
            aria-label={reveal ? "Hide password" : "Show password"}
            onClick={() => setReveal((r) => !r)}
            className="text-kink-dim hover:text-kink-cream"
          >
            {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : valid ? (
          <CheckCircle2 size={18} className="text-kink-gold" aria-hidden />
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-[13px] text-red-400">{error}</p>
      ) : helper ? (
        <p className="mt-1.5 text-[13px] text-kink-faint">{helper}</p>
      ) : null}
    </div>
  );
}
