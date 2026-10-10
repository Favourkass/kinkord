import type { KinkCurrency } from "@/domain/kinkcoins";
import type { GiftInDoubt, UnansweredWithdrawal } from "@/domain/wallet";

/**
 * Money requests sent but not yet answered (a lost response), kept in this browser per member,
 * so a reload or a later visit sends them again with the same key instead of starting a second
 * one. Storage can be off (private mode): then they last as long as the page.
 */
const key = (slot: string, memberId: string) => `kinkord:unanswered:${slot}:${memberId}`;

function read(slot: string, memberId: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key(slot, memberId));
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function write(slot: string, memberId: string, value: object) {
  try {
    localStorage.setItem(key(slot, memberId), JSON.stringify(value));
  } catch {
    // Kept for this page only.
  }
}
function clear(slot: string, memberId: string) {
  try {
    localStorage.removeItem(key(slot, memberId));
  } catch {
    // Nothing kept to clear.
  }
}

const isCurrency = (v: unknown): v is KinkCurrency => v === "coin" || v === "star" || v === "crown";
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export const pendingTransfersRepository = {
  /** An unanswered withdrawal kept for this member, if a whole one is. */
  withdrawal(memberId: string): UnansweredWithdrawal | null {
    const v = read("withdrawal", memberId);
    return v &&
      isCurrency(v.currency) &&
      isText(v.quantity) &&
      isText(v.bankId) &&
      isText(v.key) &&
      Number.isSafeInteger(v.expectedAmountKobo)
      ? {
          currency: v.currency,
          quantity: v.quantity,
          bankId: v.bankId,
          key: v.key,
          expectedAmountKobo: v.expectedAmountKobo as number,
        }
      : null;
  },
  keepWithdrawal: (memberId: string, request: UnansweredWithdrawal) =>
    write("withdrawal", memberId, request),
  /** Clears the kept withdrawal only if it's the one answered (another tab may have kept a newer one). */
  settleWithdrawal(memberId: string, key: string) {
    if (read("withdrawal", memberId)?.key === key) clear("withdrawal", memberId);
  },
  /** A gift in doubt kept for this member, if a whole one is. */
  gift(memberId: string): GiftInDoubt | null {
    const v = read("gift", memberId);
    return v && isText(v.postId) && isCurrency(v.currency) && isText(v.quantity) && isText(v.key)
      ? { postId: v.postId, currency: v.currency, quantity: v.quantity, key: v.key }
      : null;
  },
  keepGift: (memberId: string, gift: GiftInDoubt) => write("gift", memberId, gift),
  /** Clears the kept gift only if it's the one answered (another tab may have kept a newer one). */
  settleGift(memberId: string, key: string) {
    if (read("gift", memberId)?.key === key) clear("gift", memberId);
  },
};
