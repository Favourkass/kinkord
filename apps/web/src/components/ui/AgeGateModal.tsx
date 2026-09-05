"use client";

import { useEffect } from "react";
import Image from "next/image";

export interface AgeGatePoint {
  icon: string;
  text: string;
}

export interface AgeGateModalProps {
  open: boolean;
  title: string;
  badge: string;
  statement: string;
  intro?: string;
  points?: readonly AgeGatePoint[];
  warning?: string;
  confirmLabel: string;
  declineLabel: string;
  onConfirm: () => void;
  onDecline: () => void;
}

export default function AgeGateModal({
  open,
  title,
  badge,
  statement,
  intro,
  points,
  warning,
  confirmLabel,
  declineLabel,
  onConfirm,
  onDecline,
}: AgeGateModalProps) {
  useEffect(() => {
    if (!open) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-md transition-opacity animate-in fade-in duration-300 pointer-events-none"
        aria-hidden="true"
      />

      {/* Modal Window */}
      <div className="relative z-10 w-full max-w-[480px] sm:max-w-[540px] max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[18px] border border-kink-amber/60 bg-[#0d0d0c] p-5 sm:p-7 shadow-2xl shadow-black/95 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Logo Header */}
        <div className="relative flex size-13 sm:size-14 shrink-0 items-center justify-center rounded-2xl border border-kink-amber/50 bg-[#1a1400] shadow-inner mb-2.5">
          <Image
            src="/brand/logo-badge.png"
            alt="Kinkord"
            width={38}
            height={38}
            priority
            unoptimized
            className="object-contain"
          />
        </div>

        <span className="rounded-full border border-kink-amber/40 bg-[#29210f] px-3.5 py-1 text-[11px] sm:text-[12px] font-extrabold uppercase tracking-[1.5px] text-kink-gold-bright">
          {badge}
        </span>

        <h2
          id="age-gate-title"
          className="mt-3 text-[22px] sm:text-[26px] font-black leading-tight text-kink-gold-bright uppercase tracking-wide"
        >
          {title}
        </h2>

        {/* Diamond Star Divider */}
        <div className="relative my-3.5 flex w-full items-center justify-center">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-kink-amber/60 to-transparent" />
          <div className="absolute px-2.5 bg-[#0d0d0c]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="text-kink-gold-bright"
              aria-hidden
            >
              <path
                d="M7 0L8.5 5.5L14 7L8.5 8.5L7 14L5.5 8.5L0 7L5.5 5.5L7 0Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        {/* Statement */}
        <p className="text-[15px] sm:text-[17px] font-bold text-white leading-snug">{statement}</p>

        {/* Intro */}
        {intro && (
          <p className="mt-2 text-[12px] sm:text-[13px] font-medium leading-relaxed text-kink-mist">
            {intro}
          </p>
        )}

        {/* Bullet Points */}
        {points && points.length > 0 && (
          <ul className="mt-3.5 w-full space-y-2 rounded-[12px] border border-kink-amber/25 bg-black/60 p-3 sm:p-4 text-left">
            {points.map((pt, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[12px] sm:text-[13.5px] font-medium text-[#f0f0ea] leading-snug"
              >
                <span className="shrink-0 text-[15px]" aria-hidden>
                  {pt.icon}
                </span>
                <span>{pt.text}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Warning Callout */}
        {warning && (
          <div className="mt-3 w-full rounded-[10px] border border-[#ff4444]/40 bg-[#250d0d]/70 p-3 text-left">
            <p className="text-[11px] sm:text-[12.5px] font-medium text-[#ffc5c5] leading-relaxed">
              {warning}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-[52px] sm:h-[56px] w-full items-center justify-center gap-2 rounded-[10px] bg-kink-gold-bright text-[14px] sm:text-[15px] font-extrabold uppercase tracking-[0.5px] text-black transition hover:brightness-110 active:scale-[0.98] shadow-lg shadow-kink-gold-bright/20 cursor-pointer"
          >
            {confirmLabel}
          </button>

          <button
            type="button"
            onClick={onDecline}
            className="flex h-[46px] sm:h-[48px] w-full items-center justify-center gap-2 rounded-[10px] border border-kink-amber/40 text-[13px] sm:text-[14px] font-semibold text-kink-mist transition hover:border-kink-amber hover:text-white hover:bg-white/5 active:scale-[0.98] cursor-pointer"
          >
            {declineLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
