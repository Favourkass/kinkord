"use client";

import { useEffect } from "react";
import { Share, X, Download } from "lucide-react";

export interface PwaInstallToastProps {
  open: boolean;
  onClose: () => void;
  isIos: boolean;
}

export function PwaInstallToast({ open, onClose, isIos }: PwaInstallToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 inset-x-4 mx-auto max-w-md z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-kink-amber/40 bg-[#141414]/95 p-4 text-white shadow-2xl backdrop-blur-md">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-kink-amber/30 bg-black/60 text-kink-amber">
          {isIos ? <Share className="size-5" /> : <Download className="size-5" />}
        </div>
        <div className="flex-1 text-xs leading-relaxed">
          <p className="font-bold text-kink-gold-bright text-sm mb-1">
            {isIos ? "Install on iOS" : "Install Kinkord"}
          </p>
          {isIos ? (
            <p className="text-[#d4d4d4]">
              Tap <span className="font-semibold text-white">Share</span>, then select{" "}
              <span className="font-semibold text-kink-gold-bright">&quot;Add to Home Screen&quot;</span>, and tap{" "}
              <span className="font-semibold text-white">Add</span>.
            </p>
          ) : (
            <p className="text-[#d4d4d4]">
              To install Kinkord, use your browser&apos;s{" "}
              <span className="font-semibold text-kink-gold-bright">Install App</span> or{" "}
              <span className="font-semibold text-white">Add to Home Screen</span> menu option.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close message"
          className="rounded-lg p-1 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
