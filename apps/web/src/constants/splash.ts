/**
 * Brand splash shown on the app's entry route while the session lookup runs.
 *
 * Asset names carry a version suffix so they can be cached immutably (see the
 * `headers()` rule in next.config.ts). Ship the next animation as `-v3`
 * alongside these rather than overwriting them: the cache rule is `immutable`,
 * so a browser that already has `-v2` will not even revalidate it, and an
 * overwrite would never reach anyone who has opened the app before.
 */
export const BRAND_SPLASH = {
  videoSrc: "/brand/splash/kinkord-splash-v2.mp4",
  posterSrc: "/brand/splash/kinkord-splash-v2.jpg",
  /** Announced to screen readers, which never see the animation. */
  label: "Kinkord is loading",
} as const;

/**
 * Fallback floor for when there is no animation to wait on — reduced motion, a
 * blocked autoplay, or a video that failed to load. When the animation does
 * play, it runs to the end instead (CEO, 2026-09-15).
 */
export const SPLASH_MIN_MS = 1500;

/**
 * How long the video gets to actually start before we stop waiting on it.
 * Autoplay refusals raise no event, so this is the only way to notice one.
 */
export const SPLASH_START_MS = 2500;

/**
 * Hard stop, so a stalled download or a video that never reports its end can
 * never trap someone on the splash. Must clear the clip's own length (5.53s)
 * plus a little buffering, or it would cut the animation short.
 */
export const SPLASH_MAX_MS = 10000;

/** Must match the overlay’s CSS transition so it unmounts only once faded. */
export const SPLASH_FADE_MS = 500;
