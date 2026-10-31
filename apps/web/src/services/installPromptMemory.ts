/**
 * When a member puts off the full-screen install prompt, for how long. Kept in
 * this browser only; unreadable storage (a private window) just means asking
 * again next visit.
 */

/** "Not now" keeps the prompt away this many days. */
export const INSTALL_PROMPT_SNOOZE_DAYS = 7;

const KEY = "kinkord_pwa_install_snoozed_until";
/** The old banner's "dismissed for good", from before the full-screen prompt. */
const OLD_KEY = "kinkord_pwa_install_dismissed";
const SNOOZED_EVENT = "kinkord:install-snoozed";
const DAY_MS = 24 * 60 * 60 * 1000;

export const installPromptMemory = {
  /** Keep the landing screen, global prompt and other tabs in sync. */
  subscribe(callback: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) callback();
    };
    window.addEventListener(SNOOZED_EVENT, callback);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SNOOZED_EVENT, callback);
      window.removeEventListener("storage", onStorage);
    };
  },
  /** Put off, and the week isn't over. */
  isSnoozed(now = Date.now()): boolean {
    try {
      const until = Number(localStorage.getItem(KEY));
      return Number.isFinite(until) && until > now;
    } catch {
      return false;
    }
  },
  snooze(now = Date.now()): void {
    try {
      localStorage.setItem(KEY, String(now + INSTALL_PROMPT_SNOOZE_DAYS * DAY_MS));
      localStorage.removeItem(OLD_KEY);
    } catch {
      // Storage off or full: the prompt may come back next visit.
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SNOOZED_EVENT));
  },
};
