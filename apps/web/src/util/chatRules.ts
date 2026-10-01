/**
 * Where the acknowledgment lives. Two keys on purpose: dismissing with just
 * "I Understand" is a this-tab decision, ticking "Never show this again" is a
 * this-device decision. Splitting them means neither flag has to encode what
 * the other means.
 *
 * A server-side `POST /chat/acknowledge-rules` would move the "forever" half
 * onto the account, so a new phone would not re-show it — left out here
 * because the message is a community rule, not a legal attestation, and
 * per-device is the honest place for it today.
 */
const SESSION_KEY = "kinkord.chatRules.acked";
const FOREVER_KEY = "kinkord.chatRules.never";

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    // Private mode, storage disabled, quota — none of these should gate chat.
    return fallback;
  }
};

export const chatRulesStore = {
  /** True when the gate should stay down: acked this tab, or acked forever. */
  isAcknowledged(): boolean {
    return safe(
      () =>
        localStorage.getItem(FOREVER_KEY) === "1" || sessionStorage.getItem(SESSION_KEY) === "1",
      false,
    );
  },

  /** Called by "I Understand". `forever` reflects the checkbox. */
  acknowledge(forever: boolean): void {
    safe(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      if (forever) localStorage.setItem(FOREVER_KEY, "1");
    }, undefined);
  },

  /** Test / dev helper; not wired to a UI control. */
  reset(): void {
    safe(() => {
      localStorage.removeItem(FOREVER_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }, undefined);
  },
};
