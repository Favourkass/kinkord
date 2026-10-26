"use client";

import { useEffect } from "react";

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  /** How long it stays up. */
  ms?: number;
  /** A button beside the message, e.g. Undo; it stays up longer then. */
  action?: { label: string; onClick: () => void } | null;
}

/** Brief confirmation for an action with nothing else to show for it, e.g. a copied link. */
export default function Toast({ message, onDismiss, ms, action = null }: ToastProps) {
  const stay = ms ?? (action ? 5000 : 2500);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, stay);
    return () => clearTimeout(timer);
  }, [message, stay, onDismiss]);

  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[88px] z-[140] flex justify-center px-[16px] lg:bottom-[32px]"
    >
      <p className="flex items-center gap-[14px] rounded-full bg-feed-sheet px-[18px] py-[10px] text-[13px] font-medium text-feed-text shadow-lg ring-1 ring-feed-line">
        {message}
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss();
            }}
            className="font-bold text-kink-gold-bright hover:underline"
          >
            {action.label}
          </button>
        )}
      </p>
    </div>
  );
}
