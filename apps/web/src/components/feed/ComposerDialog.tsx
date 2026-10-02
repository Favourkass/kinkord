"use client";

import { useEffect, useRef } from "react";
import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";
import type { DraftPhotoVM } from "@/domain/post";

export interface ComposerDialogProps {
  open: boolean;
  /** Opens the file picker as soon as the dialog appears (the photo shortcut). */
  autoPickPhoto: boolean;
  authorName: string;
  avatarUrl: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
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
  };
}

/**
 * Write-a-post dialog. Photos upload while the caption is being typed, so each
 * tile shows its own progress and its own failure rather than the whole post
 * waiting on the slowest one.
 */
export default function ComposerDialog(p: ComposerDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!p.open) return;
    if (p.autoPickPhoto) fileRef.current?.click();
    else textRef.current?.focus();
  }, [p.open, p.autoPickPhoto]);

  if (!p.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.labels.title}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-[24px]"
    >
      <div className="flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[20px] bg-feed-sheet sm:rounded-[20px]">
        <header className="flex items-center justify-between border-b border-feed-line px-[20px] py-[16px]">
          <h2 className="text-[16px] font-bold text-feed-text">{p.labels.title}</h2>
          <button
            type="button"
            onClick={p.onClose}
            aria-label={p.labels.cancel}
            className="text-feed-muted transition-colors hover:text-feed-text"
          >
            <MaskIcon src="/app/feed/icon-close.svg" width={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-[20px] py-[16px]">
          <div className="flex items-center gap-[12px]">
            <AvatarCircle src={p.avatarUrl} alt="" size={40} ringClassName="bg-kink-gold-bright" />
            <div className="flex flex-col gap-[4px]">
              <span className="text-[14px] font-bold text-feed-text">{p.authorName}</span>
              <label className="sr-only" htmlFor="composer-visibility">
                {p.labels.visibilityLabel}
              </label>
              <select
                id="composer-visibility"
                value={p.visibility}
                onChange={(e) => p.onVisibilityChange(e.target.value)}
                className="rounded-[6px] border border-feed-line bg-transparent px-[8px] py-[2px] text-[12px] font-medium text-feed-muted"
              >
                {p.visibilities.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            ref={textRef}
            value={p.draft}
            maxLength={p.maxLength}
            onChange={(e) => p.onDraftChange(e.target.value)}
            placeholder={p.labels.placeholder}
            rows={5}
            className="mt-[16px] w-full resize-none bg-transparent text-[15px] leading-[22px] text-feed-text outline-none placeholder:text-feed-muted"
          />

          {p.photos.length > 0 && (
            <ul className="grid grid-cols-2 gap-[8px] pt-[8px]">
              {p.photos.map((photo) => (
                <li
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-[10px] bg-feed-media"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  <img src={photo.previewUrl} alt="" className="size-full object-cover" />
                  {photo.uploading && (
                    <span className="absolute inset-0 grid place-items-center bg-black/40 text-[12px] font-medium text-white">
                      …
                    </span>
                  )}
                  {photo.error && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 px-[8px] py-[4px] text-[11px] text-[#ff8f8f]">
                      {photo.error}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => p.onRemovePhoto(photo.id)}
                    aria-label={p.labels.removePhoto}
                    className="absolute right-[6px] top-[6px] grid size-[24px] place-items-center rounded-full bg-black/60 text-white"
                  >
                    <MaskIcon src="/app/feed/icon-close.svg" width={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {p.error && <p className="pt-[12px] text-[13px] font-medium text-[#e5484d]">{p.error}</p>}
        </div>

        <footer className="flex items-center gap-[12px] border-t border-feed-line px-[20px] py-[14px]">
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
            disabled={p.photoSlots === 0}
            className="flex items-center gap-[8px] text-[14px] font-medium text-feed-text disabled:opacity-40"
          >
            <MaskIcon src="/app/profile/icon-image-fill.svg" width={19} />
            {p.labels.addPhoto}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={p.onSubmit}
            disabled={!p.canPost}
            className="rounded-[8px] bg-kink-gold-bright px-[22px] py-[8px] text-[14px] font-bold text-kink-ink disabled:opacity-40"
          >
            {p.posting ? p.labels.posting : p.labels.submit}
          </button>
        </footer>
      </div>
    </div>
  );
}
