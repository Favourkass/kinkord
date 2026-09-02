"use client";

import { Download, Check } from "lucide-react";

export interface PwaDownloadButtonProps {
  onClick: () => void;
  label?: string;
  installedLabel?: string;
  isInstalled?: boolean;
  compact?: boolean;
  variant?: "pill" | "primary" | "outline" | "compact";
  className?: string;
  disabled?: boolean;
}

export function PwaDownloadButton({
  onClick,
  label = "Download Kinkord",
  installedLabel = "Installed",
  isInstalled = false,
  compact = false,
  variant = "pill",
  className = "",
  disabled = false,
}: PwaDownloadButtonProps) {
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={isInstalled ? installedLabel : label}
        className={`grid place-items-center rounded-[24px] bg-kink-gold-deep font-extrabold tracking-[0.3px] text-black transition hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          compact ? "h-[28px] w-[119px] text-[10px]" : "h-[60px] w-[254px] text-[24px]"
        } ${className}`}
      >
        {isInstalled ? installedLabel : label}
      </button>
    );
  }

  if (variant === "outline") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/50 bg-black/40 px-4 py-2 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 active:scale-95 transition cursor-pointer disabled:opacity-50 ${className}`}
      >
        {isInstalled ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        <span>{isInstalled ? installedLabel : label}</span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-black hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-50 ${className}`}
      >
        {isInstalled ? <Check className="h-3 w-3" /> : <Download className="h-3 w-3" />}
        <span>{isInstalled ? installedLabel : label}</span>
      </button>
    );
  }

  // Default "primary"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] px-5 py-3 text-sm font-bold text-[#0a0a0a] shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-50 ${className}`}
    >
      {isInstalled ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      <span>{isInstalled ? installedLabel : label}</span>
    </button>
  );
}
