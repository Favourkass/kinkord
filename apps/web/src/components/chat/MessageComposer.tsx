"use client";

import { useRef, useState } from "react";

/** The photo button, and the photo attached to the next message. */
export interface ComposerPhotoProps {
  /** Photos are open in this thread; if not, the button says why instead of opening the picker. */
  allowed: boolean;
  draft: { previewUrl: string; uploading: boolean; error: string | null } | null;
  addLabel: string;
  removeLabel: string;
  uploadingLabel: string;
  onPick: (file: File) => void;
  onRemove: () => void;
  onLocked: () => void;
}

export interface MessageComposerProps {
  onSend: (body: string) => void;
  onTyping?: (active: boolean) => void;
  placeholder: string;
  sendLabel: string;
  maxLength: number;
  disabled?: boolean;
  photo?: ComposerPhotoProps;
}

/**
 * Input row at the bottom of a thread. Sending on Enter (no Shift) matches
 * every messaging app in the world. An attached photo sits above the row, and
 * the text, if any, goes with it as its caption.
 */
export default function MessageComposer({
  onSend,
  onTyping,
  placeholder,
  sendLabel,
  maxLength,
  disabled = false,
  photo,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = photo?.draft ?? null;
  const photoReady = draft !== null && !draft.uploading && draft.error === null;
  // A photo still uploading, or one that failed, holds the message back.
  const canSend = !disabled && (draft === null ? value.trim().length > 0 : photoReady);

  const submit = () => {
    if (!canSend) return;
    onTyping?.(false);
    onSend(value.trim());
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <footer className="border-t border-app-line bg-app-surface px-[16px] py-[10px] pb-[calc(10px+env(safe-area-inset-bottom))]">
      {photo && draft && (
        <div className="flex items-center gap-[10px] pb-[10px]">
          <span className="relative size-[56px] shrink-0 overflow-hidden rounded-[10px] bg-app-input">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file */}
            <img src={draft.previewUrl} alt="" className="size-full object-cover" />
            {draft.uploading && (
              <span className="absolute inset-0 grid place-items-center bg-black/50 text-[10px] font-semibold text-white">
                {photo.uploadingLabel}
              </span>
            )}
          </span>
          <p className="min-w-0 flex-1 text-[12px] text-app-danger">{draft.error}</p>
          <button
            type="button"
            onClick={photo.onRemove}
            aria-label={photo.removeLabel}
            className="grid size-[32px] shrink-0 place-items-center rounded-full text-app-muted hover:bg-app-input"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              focusable="false"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
      <div className="flex items-center gap-[10px]">
        {photo && (
          <>
            <button
              type="button"
              onClick={() => (photo.allowed ? fileRef.current?.click() : photo.onLocked())}
              disabled={disabled || draft !== null}
              aria-label={photo.addLabel}
              className={`grid size-[40px] shrink-0 place-items-center rounded-full disabled:opacity-40 ${
                photo.allowed ? "text-app-text hover:bg-app-input" : "text-app-muted"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                focusable="false"
              >
                {/* A framed picture: the "photo" glyph messaging apps share. */}
                <rect
                  x="3"
                  y="4.5"
                  width="18"
                  height="15"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.9"
                />
                <circle cx="9" cy="10" r="1.8" fill="currentColor" />
                <path
                  d="M4 17l4.8-4.6a1.5 1.5 0 012.1 0L15 16.5l1.8-1.7a1.5 1.5 0 012.1 0L21 17"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Cleared so picking the same photo again still fires a change.
                e.target.value = "";
                if (file) photo.onPick(file);
              }}
            />
          </>
        )}
        <input
          ref={inputRef}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            onTyping?.(e.target.value.trim().length > 0);
          }}
          onBlur={() => onTyping?.(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="h-[40px] min-w-0 flex-1 rounded-[20px] border border-app-line bg-app-input px-[16px] text-[14px] text-app-text outline-none placeholder:text-app-muted disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
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
      </div>
    </footer>
  );
}
