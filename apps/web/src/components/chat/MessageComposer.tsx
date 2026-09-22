"use client";

import { useRef, useState } from "react";
//import MaskIcon from "@/components/app/MaskIcon";

export interface MessageComposerProps {
  onSend: (body: string) => void;
  onTyping?: (isTyping: boolean) => void;
  placeholder: string;
  sendLabel: string;
  maxLength: number;
  disabled?: boolean;
}

/**
 * Input row at the bottom of a thread. Typing events fire on every keystroke
 * that changes emptiness (idle → typing), and a stop event goes out when the
 * field empties or the message is sent. Sending on Enter (no Shift) matches
 * every messaging app in the world.
 */
export default function MessageComposer({
  onSend,
  onTyping,
  placeholder,
  sendLabel,
  maxLength,
  disabled = false,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [wasEmpty, setWasEmpty] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (next: string) => {
    setValue(next);
    const nowEmpty = next.trim().length === 0;
    if (wasEmpty && !nowEmpty) onTyping?.(true);
    if (!wasEmpty && nowEmpty) onTyping?.(false);
    setWasEmpty(nowEmpty);
  };

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    setWasEmpty(true);
    onTyping?.(false);
    inputRef.current?.focus();
  };

  return (
    <footer className="flex items-center gap-[10px] border-t border-app-line bg-app-surface px-[16px] py-[10px] pb-[calc(10px+env(safe-area-inset-bottom))]">
      <input
        ref={inputRef}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="h-[40px] flex-1 rounded-[20px] border border-app-line bg-app-input px-[16px] text-[14px] text-app-text outline-none placeholder:text-app-muted disabled:opacity-60"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        aria-label={sendLabel}
        className="grid size-[40px] shrink-0 place-items-center rounded-full bg-kink-gold-bright text-kink-ink disabled:opacity-40"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
          {/* Arrow up — the "send" glyph every messaging app uses today. */}
          <path
            d="M12 20V5M12 5l-6 6M12 5l6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </footer>
  );
}
