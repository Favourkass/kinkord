"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Download,
  Monitor,
  Smartphone,
  Share,
  PlusSquare,
  MoreVertical,
  X,
  CheckCircle2,
} from "lucide-react";

export interface PwaInstallModalProps {
  open: boolean;
  onClose: () => void;
  isIos: boolean;
  isAndroid: boolean;
  canPromptDirectly: boolean;
  isInstalled: boolean;
  onInstallDirectly?: () => void;
}

type PlatformTab = "ios" | "android" | "desktop";

export function PwaInstallModal({
  open,
  onClose,
  isIos,
  isAndroid,
  canPromptDirectly,
  isInstalled,
  onInstallDirectly,
}: PwaInstallModalProps) {
  const defaultTab: PlatformTab = isIos ? "ios" : isAndroid ? "android" : "desktop";
  const [userSelectedTab, setUserSelectedTab] = useState<PlatformTab | null>(null);
  const activeTab = userSelectedTab ?? defaultTab;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#D4AF37]/40 bg-[#121212] p-6 shadow-2xl shadow-black/90 sm:p-8 animate-in fade-in zoom-in-95 duration-200 overscroll-contain">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#a3a3a3] hover:bg-white/10 hover:text-[#f5f5f0] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 pr-6">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#D4AF37]/40 shadow-lg shadow-black/80 bg-[#0a0a0a]">
            <Image
              src="/icons/icon-192x192.png"
              alt="Kinkord"
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 id="pwa-install-title" className="text-xl font-bold tracking-tight text-[#f5f5f0]">
              Download Kinkord App
            </h2>
            <p className="text-xs text-[#a3a3a3] mt-0.5">
              Install the progressive web app for instant access and full-screen experience.
            </p>
          </div>
        </div>

        {/* Installed State */}
        {isInstalled ? (
          <div className="mt-6 rounded-xl border border-[#D4AF37]/30 bg-[#1a1a1a]/60 p-4 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#D4AF37] mb-2" />
            <p className="text-sm font-semibold text-[#f5f5f0]">Kinkord is Already Installed</p>
            <p className="mt-1 text-xs text-[#a3a3a3]">
              You can launch Kinkord directly from your home screen or application launcher.
            </p>
          </div>
        ) : (
          <>
            {/* Direct prompt trigger button if available */}
            {canPromptDirectly && onInstallDirectly && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={onInstallDirectly}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] py-3 text-sm font-bold text-[#0a0a0a] shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Install Kinkord Now</span>
                </button>
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider">
                    Or follow manual instructions
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              </div>
            )}

            {/* Platform Selection Tabs */}
            <div className={`grid grid-cols-3 gap-2 ${canPromptDirectly ? "mt-2" : "mt-6"}`}>
              <button
                type="button"
                onClick={() => setUserSelectedTab("ios")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                  activeTab === "ios"
                    ? "bg-[#D4AF37] text-black shadow-md"
                    : "bg-[#1c1c1c] text-[#a3a3a3] hover:text-[#f5f5f0] border border-white/5"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>iOS / Safari</span>
              </button>
              <button
                type="button"
                onClick={() => setUserSelectedTab("android")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                  activeTab === "android"
                    ? "bg-[#D4AF37] text-black shadow-md"
                    : "bg-[#1c1c1c] text-[#a3a3a3] hover:text-[#f5f5f0] border border-white/5"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Android</span>
              </button>
              <button
                type="button"
                onClick={() => setUserSelectedTab("desktop")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                  activeTab === "desktop"
                    ? "bg-[#D4AF37] text-black shadow-md"
                    : "bg-[#1c1c1c] text-[#a3a3a3] hover:text-[#f5f5f0] border border-white/5"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Desktop</span>
              </button>
            </div>

            {/* Step Instructions */}
            <div className="mt-4 rounded-xl border border-white/10 bg-[#161616] p-4 text-xs text-[#e5e5e5]">
              {activeTab === "ios" && (
                <ol className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      1
                    </span>
                    <span>
                      Open this page in <strong>Safari</strong> on your iPhone or iPad.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      2
                    </span>
                    <span className="leading-relaxed">
                      Tap the <strong>Share</strong> button{" "}
                      <Share className="inline h-3.5 w-3.5 text-[#D4AF37] mx-0.5 align-text-bottom" />{" "}
                      at the bottom of your browser window.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      3
                    </span>
                    <span className="leading-relaxed">
                      Scroll down and select{" "}
                      <strong className="text-[#D4AF37]">&quot;Add to Home Screen&quot;</strong>{" "}
                      <PlusSquare className="inline h-3.5 w-3.5 text-[#D4AF37] mx-0.5 align-text-bottom" />
                      , then tap <strong>Add</strong> in the top right corner.
                    </span>
                  </li>
                </ol>
              )}

              {activeTab === "android" && (
                <ol className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      1
                    </span>
                    <span>
                      Open this page in <strong>Chrome</strong> or your preferred Android browser.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      2
                    </span>
                    <span className="leading-relaxed">
                      Tap the three-dots menu{" "}
                      <MoreVertical className="inline h-3.5 w-3.5 text-[#D4AF37] mx-0.5 align-text-bottom" />{" "}
                      in the top right.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      3
                    </span>
                    <span className="leading-relaxed">
                      Select <strong className="text-[#D4AF37]">&quot;Install app&quot;</strong> or{" "}
                      <strong>&quot;Add to Home Screen&quot;</strong> and confirm.
                    </span>
                  </li>
                </ol>
              )}

              {activeTab === "desktop" && (
                <ol className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      1
                    </span>
                    <span>
                      In <strong>Chrome</strong> or <strong>Edge</strong>, look for the Install icon{" "}
                      <Download className="inline h-3.5 w-3.5 text-[#D4AF37] mx-0.5 align-text-bottom" />{" "}
                      in the right side of the address bar.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      2
                    </span>
                    <span className="leading-relaxed">
                      Click <strong className="text-[#D4AF37]">Install</strong> when prompted to add
                      Kinkord to your applications.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 font-bold text-[#D4AF37] text-[11px]">
                      3
                    </span>
                    <span>
                      Launch Kinkord anytime as a standalone desktop application with high
                      performance.
                    </span>
                  </li>
                </ol>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-[#f5f5f0] hover:bg-white/15 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
