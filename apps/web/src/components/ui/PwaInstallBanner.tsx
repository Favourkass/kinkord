"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { PwaInstallArtwork, type InstallArtwork } from "./PwaInstallArtwork";

export interface PwaInstallBannerProps {
  isInstallable: boolean;
  isInstalling: boolean;
  artwork: InstallArtwork;
  onInstall: () => void;
  onDismiss: () => void;
}

export function PwaInstallBanner({
  isInstallable,
  isInstalling,
  artwork,
  onInstall,
  onDismiss,
}: PwaInstallBannerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!isInstallable) return;
    const element = dialog.current;
    element?.showModal();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = originalOverflow;
    };
  }, [isInstallable]);

  if (!isInstallable) return null;

  return (
    <dialog
      ref={dialog}
      aria-modal="true"
      aria-label="Install Kinkord App"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-black p-0"
    >
      <button
        type="button"
        onClick={onInstall}
        disabled={isInstalling}
        aria-label="Install Kinkord App"
        aria-busy={isInstalling}
        className="flex h-full w-full items-center justify-center px-4 pb-[max(72px,calc(56px+env(safe-area-inset-bottom)))] pt-[max(72px,calc(56px+env(safe-area-inset-top)))] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-kink-gold-bright disabled:cursor-wait"
      >
        <span className="block w-[min(100%,calc((100dvh-160px)*41/48))]">
          <PwaInstallArtwork artwork={artwork} />
        </span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close install prompt"
        className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full border border-kink-gold-bright/40 bg-black text-kink-gold-bright hover:bg-zinc-900"
      >
        <X className="size-5" />
      </button>
      {isInstalling ? (
        <p
          role="status"
          className="absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] rounded-lg bg-black/95 p-2 text-center text-sm text-kink-gold-bright"
        >
          Opening installer…
        </p>
      ) : (
        // Put it off for a week, as the close button does.
        <button
          type="button"
          onClick={onDismiss}
          className="absolute inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] mx-auto w-fit px-5 py-2 text-sm font-semibold text-white/70 hover:text-white"
        >
          Not now
        </button>
      )}
    </dialog>
  );
}
