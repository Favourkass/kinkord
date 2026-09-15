/**
 * Brand splash shown on the app's entry route while the session lookup runs.
 *
 * Asset names carry a version suffix so they can be cached immutably (see the
 * `headers()` rule in next.config.ts); ship a new animation as `-v2` rather
 * than overwriting these files, or stale caches will keep the old one.
 */
export const BRAND_SPLASH = {
  videoSrc: "/brand/splash/kinkord-splash-v1.mp4",
  posterSrc: "/brand/splash/kinkord-splash-v1.jpg",
  /** Announced to screen readers, which never see the animation. */
  label: "Kinkord is loading",
} as const;

/**
 * The session check usually settles in well under a second, so without a floor
 * the animation would register as a flicker. 1500ms carries the mask and most
 * of the wordmark; raise it toward 5000 to hold the full lockup every open.
 */
export const SPLASH_MIN_MS = 1500;

/** Hard stop, so a hung or unreachable API can never trap someone on the splash. */
export const SPLASH_MAX_MS = 6000;

/** Must match the overlay’s CSS transition so it unmounts only once faded. */
export const SPLASH_FADE_MS = 500;
