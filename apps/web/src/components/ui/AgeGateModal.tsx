"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { TriangleAlert, Shield, LogOut } from "lucide-react";
import styles from "./AgeGateModal.module.css";

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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = originalStyle;
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="age-gate-title"
      onCancel={(event) => event.preventDefault()}
      className="fixed inset-0 z-[100] m-0 flex h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-transparent p-3.5 sm:p-6"
    >
      <div className={`${styles.backdrop} fixed inset-0 pointer-events-none`} aria-hidden="true" />
      <div
        className={`${styles.card} relative z-10 flex max-h-[calc(100dvh-28px)] w-full max-w-[480px] flex-col items-center overflow-y-auto overscroll-contain rounded-[18px] border p-4 text-center sm:max-w-[540px] sm:p-6`}
      >
        <div
          className={`${styles.logo} relative mb-3 grid size-16 shrink-0 place-items-center rounded-[18px] sm:size-20`}
        >
          <Image
            src="/brand/logo-badge.png"
            alt="Kinkord"
            width={54}
            height={54}
            preload
            unoptimized
            className="object-contain"
          />
        </div>
        <span className="rounded-full border border-[#b28b26] bg-black px-4 py-1 text-[10px] font-extrabold uppercase tracking-[1.5px] text-[#ffe366] sm:text-[12px]">
          {badge}
        </span>
        <h2
          id="age-gate-title"
          className={`${styles.heading} mt-3 text-[24px] font-black uppercase leading-tight tracking-tight text-[#ffdf39] sm:text-[32px]`}
        >
          {title}
        </h2>
        <div
          className={`${styles.divider} relative my-3 flex h-6 w-full items-center justify-center`}
          aria-hidden
        >
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#f2d13e] to-transparent" />
          <span className="absolute z-10 bg-[#080804] px-2">
            <svg
              width="22"
              height="22"
              viewBox="0 0 14 14"
              fill="currentColor"
              className={`${styles.star} text-[#ffe345]`}
            >
              <path d="M7 0L8.5 5.5L14 7L8.5 8.5L7 14L5.5 8.5L0 7L5.5 5.5L7 0Z" />
            </svg>
          </span>
        </div>
        <p className="text-[15px] font-bold leading-snug text-white sm:text-[18px]">{statement}</p>
        {intro && (
          <p className="mt-2 text-[12px] leading-relaxed text-[#d1d1d1] sm:text-[14px]">{intro}</p>
        )}
        {points && points.length > 0 && (
          <ul className="mt-3 w-full space-y-3 rounded-[12px] border border-[#ad862b]/65 bg-black/70 p-3 text-left sm:p-4">
            {points.map((point) => (
              <li
                key={point.text}
                className="flex items-start gap-3 text-[12px] leading-[18px] text-[#f0f0f0] sm:text-[15px] sm:leading-[22px]"
              >
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center text-[24px] leading-none"
                >
                  {point.icon}
                </span>
                <span>{point.text}</span>
              </li>
            ))}
          </ul>
        )}
        {warning && (
          <div className="mt-3 flex w-full items-center gap-3 rounded-[12px] border border-[#b23448]/70 bg-[#22070d]/80 p-3 text-left">
            <TriangleAlert size={28} className="shrink-0 text-[#ffde38]" aria-hidden />
            <p className="text-[11px] leading-[16px] text-[#f4e9eb] sm:text-[13px] sm:leading-[19px]">
              {warning}
            </p>
          </div>
        )}
        <div className="mt-4 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className={`${styles.enter} flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[13px] font-black text-black transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffe366] sm:text-[16px]`}
          >
            <Shield size={23} fill="currentColor" aria-hidden />
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#bd9228] px-3 py-3 text-[12px] font-semibold text-[#dedede] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffe366] sm:text-[15px]"
          >
            <LogOut size={21} className="text-[#dba858]" aria-hidden />
            {declineLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
