"use client";

import Image from "next/image";
import { Download, Share, X } from "lucide-react";

export interface PwaInstallBannerProps {
  isInstallable: boolean;
  isIos: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export function PwaInstallBanner({
  isInstallable,
  isIos,
  onInstall,
  onDismiss,
}: PwaInstallBannerProps) {
  if (!isInstallable) {
    return null;
  }

  return (
    <aside
      aria-label="Install App"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-[#121212]/95 backdrop-blur-md border border-[#D4AF37]/40 rounded-2xl p-4 shadow-2xl shadow-black/80 flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-[#1c1c1c] border border-[#D4AF37]/30 flex-shrink-0 flex items-center justify-center p-2 shadow-inner">
          <Image
            src="/brand/logo-badge.png"
            alt="Kinkord"
            width={32}
            height={32}
            className="object-contain"
          />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#f5f5f0] tracking-tight">
              Install Kinkord App
            </h2>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close install prompt"
              className="text-[#a3a3a3] hover:text-[#f5f5f0] p-1 -mr-1 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isIos ? (
            <div className="mt-1 text-xs text-[#a3a3a3] leading-relaxed">
              <span>To install: tap </span>
              <Share className="w-3.5 h-3.5 inline text-[#D4AF37] mx-0.5 align-text-bottom" />
              <span> Share, then select </span>
              <strong className="text-[#f5f5f0] font-medium">&quot;Add to Home Screen&quot;</strong>.
            </div>
          ) : (
            <p className="mt-1 text-xs text-[#a3a3a3] leading-relaxed">
              Add Kinkord to your home screen for full-screen view, faster load times, and instant notifications.
            </p>
          )}

          {!isIos && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onInstall}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0a0a0a] text-xs font-semibold hover:brightness-110 active:scale-95 transition cursor-pointer shadow-md shadow-[#D4AF37]/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="px-3 py-1.5 rounded-lg text-xs text-[#a3a3a3] hover:text-[#f5f5f0] transition"
              >
                Not now
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
