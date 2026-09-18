"use client";

export interface BrandSplashProps {
  videoSrc: string;
  posterSrc: string;
  label: string;
  /** False when the viewer asked for reduced motion — the poster stands in. */
  animate: boolean;
  /** Drives the fade-out; the overlay unmounts once the screen behind is ready. */
  leaving: boolean;
  /** Playback actually began — a refused autoplay never fires this. */
  onPlaying: () => void;
  /** Reached the end, or gave up loading. Either way, stop waiting on it. */
  onFinished: () => void;
}

/**
 * Full-bleed logo animation over the entry screen (CEO, 2026-09-15). The page
 * underneath still renders, so crawlers and assistive tech get the real
 * content; this only covers it while the session lookup is in flight.
 *
 * The clip is letterboxed rather than cropped — it is a centred lockup on
 * black, and the overlay is black, so the bars are invisible at any aspect.
 *
 * It plays once, to the end: the screen behind is only revealed after
 * `onFinished` (CEO, 2026-09-15). The presenter decides what to do when it
 * never starts or never ends.
 */
export default function BrandSplash({
  videoSrc,
  posterSrc,
  label,
  animate,
  leaving,
  onPlaying,
  onFinished,
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
          // `playing` alone is unreliable — a cached clip can start before the
          // listener attaches — so `timeupdate` (≈4/s while running) is the real
          // proof of playback. Neither fires when autoplay is refused, which is
          // what lets the presenter notice and fall back.
          onPlaying={onPlaying}
          onTimeUpdate={onPlaying}
          onEnded={onFinished}
          onError={onFinished}
          // The clip is a 9:16 portrait master, so it fills a phone edge to edge.
          // `cover` keeps it full-bleed on any other shape — the lockup sits in
          // the middle band, so a wider screen crops black only.
          className="size-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimisation needed
        <img src={posterSrc} alt="" aria-hidden className="size-full object-cover" />
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
