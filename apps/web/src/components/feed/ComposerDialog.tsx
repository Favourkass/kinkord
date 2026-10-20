"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Bold, Italic, Underline, Smile, X, ImagePlus } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { DraftPhotoVM } from "@/domain/post";
import type { BodyPart } from "@/domain/mentions";
import type { PostTextFormat, DraftSelection } from "@/domain/text-format";
import { useVisibleViewport } from "@/components/chat/useVisibleViewport";
import MentionSuggestions, {
  activeMentionId,
  composing,
  type MentionPickerProps,
} from "./MentionSuggestions";

export interface ComposerDialogProps {
  open: boolean;
  /** Opens the file picker as soon as the dialog appears (the photo shortcut). */
  autoPickPhoto: boolean;
  authorName: string;
  avatarUrl: string | null;
  draft: string;
  editor: {
    formats: readonly { value: PostTextFormat; label: string }[];
    emojis: readonly { value: string; label: string }[];
    labels: {
      toolbar: string;
      emoji: string;
      preview: string;
      previewTitle: string;
      edit: string;
      text: string;
      hint: string;
      limit: string;
    };
    selection: (DraftSelection & { revision: number }) | null;
    previewParts: BodyPart[];
    onFormat: (format: PostTextFormat, selection: DraftSelection) => void;
    onInsert: (value: string, selection: DraftSelection) => void;
  };
  /** The text, and where the caret is: "@" right before it suggests members. */
  onDraftChange: (value: string, caret?: number) => void;
  mentions: MentionPickerProps;
  maxLength: number;
  visibility: string;
  visibilities: readonly { value: string; label: string }[];
  onVisibilityChange: (value: string) => void;
  photos: DraftPhotoVM[];
  photoSlots: number;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  error: string | null;
  posting: boolean;
  canPost: boolean;
  onSubmit: () => void;
  onClose: () => void;
  labels: {
    title: string;
    submit: string;
    posting: string;
    cancel: string;
    addPhoto: string;
    removePhoto: string;
    placeholder: string;
    visibilityLabel: string;
    mentions: string;
    organization: string;
    verifiedOrganization: string;
  };
}

/** A full phone screen, with the keyboard-safe editor above persistent actions. */
export default function ComposerDialog(p: ComposerDialogProps) {
  return p.open ? <OpenComposerDialog {...p} /> : null;
}

const formatIcons = { bold: Bold, italic: Italic, underline: Underline };
function OpenComposerDialog(p: ComposerDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const selection = useRef<DraftSelection>({ start: p.draft.length, end: p.draft.length });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const mentionListId = useId();
  const emojiId = useId();
  const viewport = useVisibleViewport();

  useEffect(() => {
    const focused = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (p.autoPickPhoto) fileRef.current?.click();
    else textRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (focused instanceof HTMLElement) focused.focus();
    };
  }, [p.autoPickPhoto]);

  const requested = p.editor.selection;
  useLayoutEffect(() => {
    if (!requested || !textRef.current) return;
    textRef.current.focus();
    textRef.current.setSelectionRange(requested.start, requested.end);
    selection.current = { start: requested.start, end: requested.end };
  }, [requested]);
  const caretAt = p.mentions.caret?.at;
  const caretPick = p.mentions.caret?.pick;
  useLayoutEffect(() => {
    if (caretAt === undefined || !textRef.current) return;
    textRef.current.focus();
    textRef.current.setSelectionRange(caretAt, caretAt);
    selection.current = { start: caretAt, end: caretAt };
  }, [caretAt, caretPick]);
  // Grow with the draft so a long post scrolls naturally inside the editor.
  useLayoutEffect(() => {
    const box = textRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.max(140, (viewport?.height ?? 750) - 350, box.scrollHeight)}px`;
  }, [p.draft, viewport?.height]);
  const range = () => {
    const box = textRef.current;
    if (box) selection.current = { start: box.selectionStart, end: box.selectionEnd };
    return selection.current;
  };
  const format = (value: PostTextFormat) => p.editor.onFormat(value, range());
  const modalKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || composing(event)) return;
    if (event.key === "Escape" && !p.posting) {
      event.preventDefault();
      p.onClose();
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea, select, [tabindex="0"]',
      ) ?? [],
    ).filter((node) => node.offsetParent !== null);
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.labels.title}
      ref={dialogRef}
      onKeyDown={modalKey}
      style={{ top: viewport?.top ?? 0, height: viewport?.height ?? "100dvh" }}
      className="fixed inset-x-0 z-[120] flex items-center justify-center bg-black sm:bg-black/75 sm:p-6"
    >
      <div className="flex h-full max-h-full w-full flex-col overflow-hidden bg-black text-white sm:h-[min(820px,calc(100dvh-48px))] sm:max-w-[720px] sm:rounded-2xl sm:border sm:border-white/15">
        <header className="flex shrink-0 items-center gap-3 border-b border-white/15 px-4 py-3">
          <button
            type="button"
            onClick={p.onClose}
            disabled={p.posting}
            aria-label={p.labels.cancel}
            className="grid size-10 place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-40"
          >
            <X size={25} />
          </button>
          <h2 className="flex-1 text-center text-lg font-bold">{p.labels.title}</h2>
          <span className="size-10" aria-hidden />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 pb-4">
            <AvatarCircle src={p.avatarUrl} alt="" size={48} ringClassName="bg-kink-gold-bright" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{p.authorName}</p>
              <label className="sr-only" htmlFor="composer-visibility">
                {p.labels.visibilityLabel}
              </label>
              <select
                id="composer-visibility"
                value={p.visibility}
                disabled={p.posting}
                onChange={(e) => p.onVisibilityChange(e.target.value)}
                className="mt-1 rounded-full border border-white/25 bg-[#171717] px-3 py-1 text-xs font-semibold text-white"
              >
                {p.visibilities.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="relative">
            <textarea
              ref={textRef}
              aria-label={p.editor.labels.text}
              aria-autocomplete="list"
              aria-controls={mentionListId}
              aria-activedescendant={activeMentionId(mentionListId, p.mentions)}
              value={p.draft}
              maxLength={p.maxLength}
              readOnly={p.posting}
              onChange={(e) => {
                range();
                p.onDraftChange(e.target.value, e.target.selectionStart);
              }}
              onSelect={(e) => {
                range();
                p.onDraftChange(e.currentTarget.value, e.currentTarget.selectionStart);
              }}
              onKeyDown={(e) => {
                if (composing(e) || p.posting) return;
                const key = e.key.toLowerCase();
                if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(key)) {
                  e.preventDefault();
                  format(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
                  return;
                }
                // Enter always belongs to this multiline editor; Tab/click can pick a mention.
                if (e.key !== "Enter" && p.mentions.open && p.mentions.onKey(e.key))
                  e.preventDefault();
              }}
              placeholder={p.labels.placeholder}
              rows={8}
              className="block w-full resize-none border-0 bg-black py-2 text-[22px] leading-relaxed text-white caret-[#ffba1f] outline-none placeholder:text-[#a3a3a3] sm:text-[24px]"
            />
            <MentionSuggestions
              {...p.mentions}
              id={mentionListId}
              label={p.labels.mentions}
              organizationLabel={p.labels.organization}
              verifiedOrganizationLabel={p.labels.verifiedOrganization}
              className="mt-2"
            />
          </div>
          {p.photos.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {p.photos.map((photo) => (
                <li
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-xl bg-[#171717]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  <img src={photo.previewUrl} alt="" className="size-full object-cover" />
                  {photo.uploading && (
                    <span
                      role="status"
                      className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white"
                    >
                      …
                    </span>
                  )}
                  {photo.error && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-xs text-red-300">
                      {photo.error}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={p.posting}
                    onClick={() => p.onRemovePhoto(photo.id)}
                    aria-label={p.labels.removePhoto}
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/75 text-white"
                  >
                    <X size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {p.error && (
            <p role="alert" className="pt-3 text-sm text-red-300">
              {p.error}
            </p>
          )}
        </div>
        <footer className="shrink-0 border-t border-white/15 bg-[#0a0a0a] px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
          {emojiOpen && (
            <div
              id={emojiId}
              role="group"
              aria-label={p.editor.labels.emoji}
              className="mb-2 grid max-h-[150px] grid-cols-6 gap-1 overflow-y-auto rounded-xl border border-white/15 bg-[#171717] p-2"
            >
              {p.editor.emojis.map((emoji) => (
                <button
                  key={emoji.value}
                  type="button"
                  disabled={p.posting}
                  aria-label={emoji.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    p.editor.onInsert(emoji.value, range());
                    setEmojiOpen(false);
                  }}
                  className="grid min-h-10 place-items-center rounded-lg text-2xl hover:bg-white/10"
                >
                  {emoji.value}
                </button>
              ))}
            </div>
          )}
          <div
            role="toolbar"
            aria-label={p.editor.labels.toolbar}
            className="flex items-center gap-2 pb-2"
          >
            {p.editor.formats.map((item) => {
              const Icon = formatIcons[item.value];
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-label={item.label}
                  title={item.label}
                  disabled={p.posting}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => format(item.value)}
                  className="grid size-10 place-items-center rounded-lg border border-white/20 text-kink-gold-bright hover:bg-white/10 disabled:opacity-40"
                >
                  <Icon size={20} />
                </button>
              );
            })}
            <button
              type="button"
              aria-label={p.editor.labels.emoji}
              aria-expanded={emojiOpen}
              aria-controls={emojiId}
              disabled={p.posting}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                range();
                setEmojiOpen((v) => !v);
              }}
              className="grid size-10 place-items-center rounded-lg border border-white/20 text-kink-gold-bright"
            >
              <Smile size={21} />
            </button>
          </div>
          <div className="flex items-center gap-3 border-t border-white/10 pt-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                p.onAddPhotos(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={p.photoSlots === 0 || p.posting}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              <ImagePlus size={21} className="text-kink-gold-bright" />
              {p.labels.addPhoto}
            </button>
            <span className="ml-auto text-xs text-[#a3a3a3]">
              {p.draft.length}/{p.maxLength}
            </span>
            <button
              type="button"
              onClick={p.onSubmit}
              disabled={!p.canPost || p.posting}
              className="min-h-11 rounded-xl bg-kink-gold-bright px-6 text-sm font-bold text-black disabled:opacity-40"
            >
              {p.posting ? p.labels.posting : p.labels.submit}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
