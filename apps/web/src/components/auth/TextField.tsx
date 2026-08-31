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
      <label
        htmlFor={id}
        className="mb-2 block text-[12px] font-medium text-white lg:mb-2.5 lg:text-[20px]"
      >
        {label}
      </label>
      <div
        className={`flex h-[44px] items-center gap-3 rounded-lg border bg-kink-field px-4 transition focus-within:border-kink-gold-bright lg:h-[65px] lg:pl-8 lg:pr-4 ${
          error ? "border-red-500/70" : "border-kink-edge"
        }`}
      >
        {Icon && <Icon size={18} className="shrink-0 text-white lg:size-6" aria-hidden />}
        {leftAddon}
        <input
          id={id}
          type={inputType}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full bg-transparent text-[15px] text-white outline-none placeholder:text-kink-help lg:text-[20px]"
        />
        {type === "password" ? (
          <button
            type="button"
            aria-label={reveal ? "Hide password" : "Show password"}
            onClick={() => setReveal((r) => !r)}
            className={reveal ? "text-kink-gold-bright" : "text-white"}
          >
            {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : valid ? (
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-full bg-kink-gold-bright lg:size-7"
          >
            <CheckCircle2 size={14} className="text-black lg:size-[18px]" />
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] text-red-400 lg:text-[16px]">{error}</p>
      ) : helper ? (
        <p className="mt-1.5 text-[11px] text-kink-help lg:text-[16px]">{helper}</p>
      ) : null}
    </div>
  );
}
