"use client";

import { useEffect } from "react";

export interface MessageActionSheetProps {
  /** Above the choices, when they need one ("Delete message?"). */
  title: string | null;
  items: Array<{ key: string; label: string; danger: boolean }>;
  cancelLabel: string;
  busy: boolean;
  error: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}

/**
 * A short list of choices for one message: its menu, or who to delete it for.
 * Slides up on a phone, sits in the middle on a computer. Escape or a tap
 * outside closes it.
 */
export default function MessageActionSheet(p: MessageActionSheetProps) {
  const { onClose } = p;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title ?? undefined}
      onClick={onClose}
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center sm:p-[24px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] overflow-hidden rounded-t-[20px] bg-app-surface pb-[env(safe-area-inset-bottom)] sm:rounded-[20px]"
      >
        {p.title && (
          <h2 className="px-[20px] pb-[4px] pt-[18px] text-[16px] font-bold text-app-text">
            {p.title}
          </h2>
        )}
        <div role="menu" className="py-[6px]">
          {p.items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              autoFocus={i === 0}
              disabled={p.busy}
              onClick={() => p.onSelect(item.key)}
              className={`block w-full px-[20px] py-[13px] text-left text-[15px] font-medium hover:bg-app-input disabled:opacity-50 ${
                item.danger ? "text-app-danger" : "text-app-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {p.error && <p className="px-[20px] pb-[8px] text-[13px] text-app-danger">{p.error}</p>}
        <button
          type="button"
          onClick={onClose}
          disabled={p.busy}
          className="block w-full border-t border-app-line px-[20px] py-[13px] text-center text-[15px] font-semibold text-app-muted hover:bg-app-input disabled:opacity-50"
        >
          {p.cancelLabel}
        </button>
      </div>
    </div>
  );
}
