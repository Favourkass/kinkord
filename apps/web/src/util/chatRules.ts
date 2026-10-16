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
/** Chats this tab has been reminded about: someone new, once each. */
const CHATS_KEY = "kinkord.chatRules.chats";

/** The open chat the member hasn't written in yet, if any. */
let newChat: string | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    // Private mode, storage disabled, quota — none of these should gate chat.
    return fallback;
  }
};

const remindedChats = (): string[] =>
  safe(() => JSON.parse(sessionStorage.getItem(CHATS_KEY) ?? "[]") as string[], []);

export const chatRulesStore = {
  /** True when the gate should stay down: acked this tab, or acked forever. */
  isAcknowledged(): boolean {
    return safe(
      () =>
        localStorage.getItem(FOREVER_KEY) === "1" || sessionStorage.getItem(SESSION_KEY) === "1",
      false,
    );
  },

  /** "Never show this again" was ticked on this device: no reminders at all. */
  isOffForever(): boolean {
    return safe(() => localStorage.getItem(FOREVER_KEY) === "1", false);
  },

  /** Called by "I Understand". `forever` reflects the checkbox. */
  acknowledge(forever: boolean): void {
    safe(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      if (forever) localStorage.setItem(FOREVER_KEY, "1");
      if (newChat && !remindedChats().includes(newChat)) {
        sessionStorage.setItem(CHATS_KEY, JSON.stringify([...remindedChats(), newChat]));
      }
    }, undefined);
    changed();
  },

  /**
   * The member opened a chat they haven't written in yet: someone new, where
   * the reminder not to send money matters most. Shown once per chat per tab.
   */
  openNewChat(conversationId: string): void {
    newChat = conversationId;
    changed();
  },

  closeNewChat(conversationId: string): void {
    if (newChat !== conversationId) return;
    newChat = null;
    changed();
  },

  /** The new chat to remind about now, or null when there's none or it's been seen. */
  pendingNewChat(): string | null {
    return newChat && !remindedChats().includes(newChat) ? newChat : null;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Test / dev helper; not wired to a UI control. */
  reset(): void {
    safe(() => {
      localStorage.removeItem(FOREVER_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(CHATS_KEY);
    }, undefined);
    newChat = null;
  },
};
