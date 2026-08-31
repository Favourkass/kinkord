"use client";

interface Props {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "solid" | "outline";
  arrow?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/** The big pill CTA from the designs: solid gold or gold-outline. */
export default function GoldCta({
  label,
  onClick,
  type = "button",
  variant = "solid",
  arrow = true,
  disabled,
  loading,
  className = "",
}: Props) {
  const skin =
    variant === "solid"
      ? "bg-kink-gold-bright text-[#0d0d0d] font-bold uppercase tracking-[2px] hover:brightness-105"
      : "border-2 border-kink-gold-bright bg-transparent font-semibold text-kink-gold-bright hover:bg-kink-gold-bright/10";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative flex h-[48px] w-full items-center justify-center gap-3 rounded-full px-8 text-[15px] transition disabled:cursor-not-allowed disabled:opacity-40 lg:h-[68px] lg:text-[24px] ${skin} ${className}`}
    >
      {loading ? "Please wait…" : label}
      {arrow && !loading && (
        <span aria-hidden className="text-[1.2em] leading-none">
          →
        </span>
      )}
    </button>
  );
}
