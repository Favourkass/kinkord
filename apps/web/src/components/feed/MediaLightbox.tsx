"use client";

import MaskIcon from "@/components/app/MaskIcon";
import type { PostMediaVM } from "@/domain/post";

export interface MediaLightboxProps {
  media: PostMediaVM | null;
  onClose: () => void;
  closeLabel: string;
}

/** Full-size view of one photo, opened by tapping it in a post. */
export default function MediaLightbox({ media, onClose, closeLabel }: MediaLightboxProps) {
  if (!media?.fullSrc) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={media.alt}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/90 p-[16px]"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-[16px] top-[16px] text-white"
      >
        <MaskIcon src="/app/feed/icon-close.svg" width={24} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable */}
      <img
        src={media.fullSrc}
        alt={media.alt}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
