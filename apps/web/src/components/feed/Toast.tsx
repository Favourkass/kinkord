"use client";

import { useEffect } from "react";

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  /** How long it stays up. */
  ms?: number;
}

/** Brief confirmation for an action with nothing else to show for it, e.g. a copied link. */
export default function Toast({ message, onDismiss, ms = 2500 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [message, ms, onDismiss]);

  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[88px] z-[140] flex justify-center px-[16px] lg:bottom-[32px]"
    >
      <p className="rounded-full bg-feed-sheet px-[18px] py-[10px] text-[13px] font-medium text-feed-text shadow-lg ring-1 ring-feed-line">
        {message}
      </p>
    </div>
  );
}
