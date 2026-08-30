"use client";

interface AmberCtaProps {
  label: string;
  type?: "button" | "submit";
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function AmberCta({
  label,
  type = "button",
  onClick,
  loading = false,
  disabled = false,
  className = "",
}: AmberCtaProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`h-[50px] w-full rounded-full bg-kink-amber text-[20px] font-bold text-black transition-opacity disabled:opacity-60 lg:rounded-[20px] lg:text-[22px] ${className}`}
    >
      {loading ? "Please wait…" : label}
    </button>
  );
}
