"use client";

export interface BrandSplashProps {
  videoSrc: string;
  posterSrc: string;
  label: string;
  /** False when the viewer asked for reduced motion — the poster stands in. */
  animate: boolean;
  /** Drives the fade-out; the overlay unmounts once the screen behind is ready. */
  leaving: boolean;
}

/**
 * Full-bleed logo animation over the entry screen (CEO, 2026-09-15). The page
 * underneath still renders, so crawlers and assistive tech get the real
 * content; this only covers it while the session lookup is in flight.
 *
 * The clip is letterboxed rather than cropped — it is a centred lockup on
 * black, and the overlay is black, so the bars are invisible at any aspect.
 */
export default function BrandSplash({
  videoSrc,
  posterSrc,
  label,
  animate,
  leaving,
}: BrandSplashProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {animate ? (
        <video
          src={videoSrc}
          poster={posterSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden
          // 16:9 source on a tall phone letterboxes to a small strip, so widen it
          // past the viewport in portrait. The lockup lives inside the middle
          // ~70% of the frame, so 125% crops black margin only.
          className="max-h-full w-full object-contain portrait:w-[125%] portrait:max-w-none"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimisation needed
        <img
          src={posterSrc}
          alt=""
          aria-hidden
          className="max-h-full w-full object-contain portrait:w-[125%] portrait:max-w-none"
        />
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
