"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useId, useState } from "react";

export interface ExpandableAvatarProps {
  src: string | null;
  /** Used as the image alt and the dialog's accessible name. */
  alt: string;
  /** Class for the trigger (the small avatar). Should set the size + rounding. */
  className?: string;
  /** Class for the absolutely-positioned wrapper (where the avatar sits in the hero/card). */
  wrapperClassName?: string;
  fetchPriority?: "high" | "low" | "auto";
  /** Accessible label for the close button. Defaults to "Close". */
  closeLabel?: string;
}

/**
 * Circular avatar that expands to a centered, animated fullscreen view on click.
 *
 * Uses framer-motion's shared-layout (`layoutId`): the trigger unmounts and the
 * lightbox image mounts in the same commit, so motion animates from the avatar's
 * on-screen rect to the final centered rect. Backdrop fades in/out with it.
 */
export default function ExpandableAvatar({
  src,
  alt,
  className,
  wrapperClassName,
  fetchPriority,
  closeLabel = "Close",
}: ExpandableAvatarProps) {
  const [open, setOpen] = useState(false);
  const layoutId = `avatar-${useId()}`;
  const reduced = useReducedMotion();

  // Body scroll lock + Esc to close, active only while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const openViewer = useCallback(() => {
    if (src) setOpen(true);
  }, [src]);

  if (!src) return null;

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.9 };
  const fade = { duration: reduced ? 0 : 0.2 };

  return (
    <>
      <div className={wrapperClassName}>
        {!open ? (
          <motion.button
            type="button"
            layoutId={layoutId}
            onClick={openViewer}
            aria-label={`View ${alt}`}
            transition={spring}
            className={`block cursor-zoom-in border-0 bg-transparent p-0 ${className ?? ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL */}
            <img
              src={src}
              alt={alt}
              fetchPriority={fetchPriority}
              decoding="async"
              draggable={false}
              className="size-full rounded-full object-cover"
            />
          </motion.button>
        ) : null}
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="avatar-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            // This is the guarantee that the image lands dead-center on any screen:
            // fixed full-viewport flexbox, both axes centered, no ancestor transforms.
            className="fixed inset-0 z-[100] flex items-center justify-center"
          >
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => setOpen(false)}
              className="absolute inset-0 cursor-zoom-out bg-black/90 backdrop-blur-md"
            />
            <motion.img
              layoutId={layoutId}
              src={src}
              alt=""
              draggable={false}
              onClick={() => setOpen(false)}
              transition={spring}
              // Equal width & height = a perfect square, then flex centers it.
              // min(90vw, 90dvh, 480px) keeps it comfortable on phones and desktops.
              className="relative z-[1] h-[min(90vw,90dvh,480px)] w-[min(90vw,90dvh,480px)] cursor-zoom-out rounded-full object-cover shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
