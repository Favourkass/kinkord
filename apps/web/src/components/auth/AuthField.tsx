"use client";

import { useId, useState, type ReactNode } from "react";
import { EyeOffIcon } from "./AuthIcons";

interface AuthFieldProps {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "tel";
  autoComplete?: string;
  error?: string | null;
}

export default function AuthField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  error,
}: AuthFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="mb-2 block text-[14px] font-medium text-white lg:mb-4 lg:text-[24px] lg:font-bold"
      >
        {label}
      </label>
      <div
        className={`flex h-[41px] items-center gap-2 rounded-[10px] border bg-black px-3 focus-within:border-kink-gold-bright lg:h-[66px] lg:gap-3 lg:px-5 ${
          error ? "border-red-500" : "border-kink-steel"
        }`}
      >
        <span className="shrink-0 text-kink-soft [&>svg]:size-6 lg:[&>svg]:size-9">{icon}</span>
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-full w-full bg-transparent text-[15px] font-light text-white outline-none placeholder:text-kink-soft lg:text-[24px]"
        />
        {isPassword && (
          <button
            type="button"
            aria-label={revealed ? "Hide password" : "Show password"}
            onClick={() => setRevealed((v) => !v)}
            className={`shrink-0 ${revealed ? "text-kink-gold-bright" : "text-white"} [&>svg]:size-6 lg:[&>svg]:size-[35px]`}
          >
            <EyeOffIcon />
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[13px] text-red-400 lg:text-[15px]">{error}</p>}
    </div>
  );
}
