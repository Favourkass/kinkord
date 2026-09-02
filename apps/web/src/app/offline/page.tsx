"use client";

import Link from "next/link";
import Image from "next/image";
import { WifiOff, RefreshCw, Home } from "lucide-react";

export default function OfflinePage() {
  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#f5f5f0] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10 space-y-6">
        <div className="flex justify-center mb-2">
          <div className="w-20 h-20 rounded-2xl bg-[#141414] border border-[#D4AF37]/30 flex items-center justify-center p-3 shadow-lg shadow-black/50">
            <Image
              src="/brand/logo-badge.png"
              alt="Kinkord Logo"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#333] text-xs text-[#D4AF37] font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-playfair text-[#f5f5f0] tracking-tight">
            You&apos;re currently offline
          </h1>
          <p className="text-sm text-[#a3a3a3] leading-relaxed">
            It looks like your internet connection was interrupted. Check your network or try reconnecting to continue exploring Kinkord.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleReload}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0a0a0a] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition cursor-pointer shadow-md shadow-[#D4AF37]/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#181818] border border-[#333] text-[#f5f5f0] hover:border-[#D4AF37]/50 font-medium text-sm transition"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
