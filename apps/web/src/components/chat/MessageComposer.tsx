"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, SendHorizontal, Smile, X } from "lucide-react";

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
  emoji?: { label: string; options: readonly string[] };
}

/** A phone's return key adds a line, as in its other messaging apps; Send sends. */
const touchKeyboard = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;

/**
 * A growing message input. On a computer Enter sends and Shift+Enter adds a line,
 * as before; on a phone Enter adds a line. Ctrl/Cmd+Enter sends on both.
 */
export default function MessageComposer({
  onSend,
  onTyping,
  placeholder,
  sendLabel,
  maxLength,
  disabled = false,
  photo,
  emoji,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
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

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  }, [value]);

  const insertEmoji = (character: string) => {
    if (disabled) return;
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + character + value.slice(end);
    if (next.length > maxLength) return;
    setValue(next);
    onTyping?.(true);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + character.length, start + character.length);
    });
  };

  return (
    <footer className="bg-[#080808] px-[8px] py-[6px] pb-[calc(8px+env(safe-area-inset-bottom))]">
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
      {emoji && emojiOpen && (
        <div
          role="group"
          aria-label={emoji.label}
          className="mb-[8px] grid grid-cols-8 gap-[2px] rounded-[18px] border border-white/10 bg-[#1b1b1b] p-[8px]"
        >
          {emoji.options.map((character) => (
            <button
              key={character}
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertEmoji(character)}
              className="grid h-[40px] place-items-center rounded-lg text-[24px] hover:bg-white/10 disabled:opacity-40"
            >
              {character}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-[7px]">
        <div className="flex min-w-0 flex-1 items-end rounded-[26px] bg-[#202020] px-[4px] py-[3px]">
          {emoji && (
            <button
              type="button"
              aria-label={emoji.label}
              aria-expanded={emojiOpen}
              disabled={disabled}
              onClick={() => setEmojiOpen(!emojiOpen)}
              className="grid size-[42px] shrink-0 place-items-center rounded-full text-app-muted hover:text-kink-gold-bright disabled:opacity-40"
            >
              {emojiOpen ? <X size={24} /> : <Smile size={24} />}
            </button>
          )}
          <textarea
            ref={inputRef}
            rows={1}
            aria-label={placeholder}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              onTyping?.(e.target.value.trim().length > 0);
            }}
            onBlur={() => onTyping?.(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEmojiOpen(false);
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              if (e.ctrlKey || e.metaKey || (!e.shiftKey && !touchKeyboard())) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="max-h-[128px] min-h-[42px] min-w-0 flex-1 resize-none bg-transparent px-[7px] py-[10px] text-[16px] leading-[22px] text-app-text outline-none placeholder:text-app-muted disabled:opacity-60"
          />
          {photo && (
            <>
              <button
                type="button"
                onClick={() => (photo.allowed ? fileRef.current?.click() : photo.onLocked())}
                disabled={disabled || draft !== null}
                aria-label={photo.addLabel}
                className="grid size-[42px] shrink-0 place-items-center rounded-full text-app-muted hover:text-kink-gold-bright disabled:opacity-40"
              >
                <Paperclip size={23} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) photo.onPick(file);
                }}
              />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={sendLabel}
          className="grid size-[48px] shrink-0 place-items-center rounded-full bg-kink-gold-bright text-kink-ink disabled:opacity-45"
        >
          <SendHorizontal size={23} fill="currentColor" strokeWidth={1.3} />
        </button>
      </div>
    </footer>
  );
}
