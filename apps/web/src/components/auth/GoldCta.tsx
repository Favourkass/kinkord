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
      ? "bg-kink-gold text-black hover:brightness-105"
      : "border-[1.5px] border-kink-amber bg-transparent text-kink-cream hover:bg-kink-amber/10";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-4 text-[17px] sm:text-[19px] font-extrabold tracking-[0.06em] uppercase transition disabled:opacity-40 disabled:cursor-not-allowed ${skin} ${className}`}
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
