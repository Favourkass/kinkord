/**
 * Money requests sent but not yet answered (a lost response), kept in this browser per member,
 * so a reload or a later visit sends them again with the same key instead of starting a second
 * one. Storage can be off (private mode): then they last as long as the page.
 */
const key = (slot: string, memberId: string) => `kinkord:unanswered:${slot}:${memberId}`;

export const pendingTransfersRepository = {
  read(slot: string, memberId: string): unknown {
    try {
      const raw = localStorage.getItem(key(slot, memberId));
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  },
  write(slot: string, memberId: string, value: unknown) {
    try {
      localStorage.setItem(key(slot, memberId), JSON.stringify(value));
    } catch {
      // Kept for this page only.
    }
  },
  clear(slot: string, memberId: string) {
    try {
      localStorage.removeItem(key(slot, memberId));
    } catch {
      // Nothing kept to clear.
    }
  },
};
