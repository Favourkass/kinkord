import type { KinkCurrency } from "@/domain/kinkcoins";
import type { GiftInDoubt, UnansweredWithdrawal } from "@/domain/wallet";

/**
 * Money requests sent but not yet answered (a lost response), kept in this browser per member,
 * each under its own request key: tabs never share an entry, so none overwrites another's. A
 * reload or a later visit sends them again with the same key instead of starting a second one.
 */
const prefix = (slot: string, memberId: string) => `kinkord:unanswered:${slot}:${memberId}:`;

/**
 * Every entry kept in a slot for a member (a damaged one is skipped), or null when storage
 * can't be read: then there's no telling what's kept, which isn't the same as nothing.
 */
function entries(slot: string, memberId: string): Record<string, unknown>[] | null {
  const start = prefix(slot, memberId);
  const found: Record<string, unknown>[] = [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(start)) keys.push(key);
    }
    for (const key of keys.sort()) {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
        if (value && typeof value === "object") found.push(value as Record<string, unknown>);
      } catch {
        // Damaged: skipped.
      }
    }
  } catch {
    return null;
  }
  return found;
}
/** True once it's really kept: storage can be off, or full. */
function keep(slot: string, memberId: string, key: string, value: object): boolean {
  try {
    localStorage.setItem(prefix(slot, memberId) + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function settle(slot: string, memberId: string, key: string) {
  try {
    localStorage.removeItem(prefix(slot, memberId) + key);
  } catch {
    // Nothing kept to clear.
  }
}

const isCurrency = (v: unknown): v is KinkCurrency => v === "coin" || v === "star" || v === "crown";
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function toWithdrawal(v: Record<string, unknown>): UnansweredWithdrawal | null {
  return isCurrency(v.currency) &&
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
}
function toGift(v: Record<string, unknown>): GiftInDoubt | null {
  return isText(v.postId) && isCurrency(v.currency) && isText(v.quantity) && isText(v.key)
    ? { postId: v.postId, currency: v.currency, quantity: v.quantity, key: v.key }
    : null;
}
const whole = <T>(value: T | null): value is T => value !== null;

export const pendingTransfersRepository = {
  /** This member's unanswered withdrawals kept in this browser (any tab's); null if unreadable. */
  withdrawals: (memberId: string): UnansweredWithdrawal[] | null =>
    entries("withdrawal", memberId)?.map(toWithdrawal).filter(whole) ?? null,
  /** True once kept; false when this browser couldn't keep it. */
  keepWithdrawal: (memberId: string, request: UnansweredWithdrawal) =>
    keep("withdrawal", memberId, request.key, request),
  settleWithdrawal: (memberId: string, key: string) => settle("withdrawal", memberId, key),
  /** This member's gifts in doubt kept in this browser (any tab's); null if unreadable. */
  gifts: (memberId: string): GiftInDoubt[] | null =>
    entries("gift", memberId)?.map(toGift).filter(whole) ?? null,
  /** True once kept; false when this browser couldn't keep it. */
  keepGift: (memberId: string, gift: GiftInDoubt) => keep("gift", memberId, gift.key, gift),
  settleGift: (memberId: string, key: string) => settle("gift", memberId, key),
};
