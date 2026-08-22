"use client";

import { useId } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  helper?: string;
  error?: string;
  icon?: LucideIcon;
}

export default function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  helper,
  error,
  icon: Icon,
}: Props) {
  const id = useId();
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-kink-cream">
        {label}
      </label>
      <div
        className={`relative flex items-center gap-3 rounded-xl border bg-kink-surface px-4 transition focus-within:border-kink-gold ${
          error ? "border-red-500/70" : "border-kink-line"
        }`}
      >
        {Icon && <Icon size={18} className="shrink-0 text-kink-gold" aria-hidden />}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-transparent py-[13px] pr-8 text-[16px] text-kink-cream outline-none [&>option]:bg-kink-surface"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown size={18} className="pointer-events-none absolute right-4 text-kink-dim" />
      </div>
      {error ? (
        <p className="mt-1.5 text-[13px] text-red-400">{error}</p>
      ) : helper ? (
        <p className="mt-1.5 text-[13px] text-kink-faint">{helper}</p>
      ) : null}
    </div>
  );
}
