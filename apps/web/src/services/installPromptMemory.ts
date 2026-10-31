/**
 * Whether the full-screen install prompt may show (founders, 2026-10-31): on every
 * visit to someone without the app, including after they uninstall it, until they
 * choose "Don't show again". "Not now", the close button or tapping install put it
 * off for the rest of this visit only. Kept in this browser; unreadable storage (a
 * private window) just means asking again.
 */

/** "Don't show again": for good, in this browser. */
const OFF_KEY = "kinkord_pwa_install_off";
/** Put off for this visit: the tab's session, so the next visit asks again. */
const VISIT_KEY = "kinkord_pwa_install_hidden";
/** Earlier rules' keys, a week's snooze and the first banner's dismissal, cleared so everyone is asked again. */
const OLD_KEYS = ["kinkord_pwa_install_snoozed_until", "kinkord_pwa_install_dismissed"];

export const installPromptMemory = {
  /** "Don't show again", from this visit or an earlier one. */
  isOff(): boolean {
    try {
      return localStorage.getItem(OFF_KEY) === "1";
    } catch {
      return false;
    }
  },
  isHiddenThisVisit(): boolean {
    try {
      return sessionStorage.getItem(VISIT_KEY) === "1";
    } catch {
      return false;
    }
  },
  hideThisVisit(): void {
    try {
      sessionStorage.setItem(VISIT_KEY, "1");
    } catch {
      // Storage off: it may come back on the next page load.
    }
  },
  turnOff(): void {
    try {
      localStorage.setItem(OFF_KEY, "1");
    } catch {
      // Storage off: the prompt may come back next visit.
    }
  },
  forgetOldRules(): void {
    try {
      for (const key of OLD_KEYS) localStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  },
};
