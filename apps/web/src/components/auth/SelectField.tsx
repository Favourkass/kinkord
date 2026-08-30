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
      <label
        htmlFor={id}
        className="mb-2 block text-[12px] font-medium text-white lg:mb-2.5 lg:text-[20px]"
      >
        {label}
      </label>
      <div
        className={`relative flex h-[44px] items-center gap-3 rounded-lg border bg-kink-field px-4 transition focus-within:border-kink-gold-bright lg:h-[65px] lg:pl-8 ${
          error ? "border-red-500/70" : "border-kink-edge"
        }`}
      >
        {Icon && <Icon size={18} className="shrink-0 text-white lg:size-6" aria-hidden />}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full appearance-none bg-transparent pr-8 text-[15px] text-white outline-none lg:text-[20px] [&>option]:bg-kink-field"
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
        <ChevronDown size={18} className="pointer-events-none absolute right-4 text-white" />
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] text-red-400 lg:text-[16px]">{error}</p>
      ) : helper ? (
        <p className="mt-1.5 text-[11px] text-kink-help lg:text-[16px]">{helper}</p>
      ) : null}
    </div>
  );
}
