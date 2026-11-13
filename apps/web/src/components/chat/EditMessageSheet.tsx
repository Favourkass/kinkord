"use client";

import { useEffect, useRef, useState } from "react";

export interface EditMessageSheetProps {
  /** The message being edited: a new one starts the editor afresh. */
  id: string;
  title: string;
  /** Its text now, to start from. */
  text: string;
  maxLength: number;
  saveLabel: string;
  cancelLabel: string;
  busy: boolean;
  error: string | null;
  onSave: (text: string) => void;
  onClose: () => void;
}

/**
 * Changing a message's text, apart from the composer, so a reply half-written
 * there stays as it was. Escape or a tap outside closes it.
 */
export default function EditMessageSheet(p: EditMessageSheetProps) {
  const [value, setValue] = useState(p.text);
  const input = useRef<HTMLTextAreaElement>(null);
  const { onClose } = p;
  const changed = value.trim() !== p.text.trim();

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

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
      aria-label={p.title}
      onClick={onClose}
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center sm:p-[24px]"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (changed && !p.busy) p.onSave(value);
        }}
        className="w-full max-w-[440px] rounded-t-[20px] bg-app-surface p-[20px] pb-[calc(20px+env(safe-area-inset-bottom))] sm:rounded-[20px]"
      >
        <h2 className="text-[18px] font-bold text-app-text">{p.title}</h2>
        <textarea
          ref={input}
          value={value}
          maxLength={p.maxLength}
          rows={4}
          aria-label={p.title}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (changed && !p.busy) p.onSave(value);
            }
          }}
          className="mt-[12px] block max-h-[40dvh] w-full resize-none rounded-[12px] border border-app-line bg-app-input px-[12px] py-[10px] text-[16px] leading-[22px] text-app-text outline-none"
        />
        {p.error && <p className="pt-[10px] text-[13px] text-app-danger">{p.error}</p>}
        <div className="flex justify-end gap-[10px] pt-[16px]">
          <button
            type="button"
            onClick={onClose}
            disabled={p.busy}
            className="rounded-full px-[16px] py-[9px] text-[14px] font-medium text-app-muted disabled:opacity-50"
          >
            {p.cancelLabel}
          </button>
          <button
            type="submit"
            disabled={!changed || p.busy}
            className="rounded-full bg-kink-gold-bright px-[18px] py-[9px] text-[14px] font-bold text-kink-ink disabled:opacity-45"
          >
            {p.saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
