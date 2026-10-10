import type { GiftInDoubt, UnansweredWithdrawal } from "@/domain/wallet";
import { pendingTransfersRepository as store } from "@/repositories/pendingTransfers.repository";
import { ApiError } from "./apiClient";

/**
 * Refusals that come before a request is read: the sign-in guard's sign-up holds, and the
 * wallet's check that the member it was sent as is the one signed in.
 */
const UNREAD_CODES = new Set([
  "PHONE_VERIFICATION_REQUIRED",
  "PROFILE_PHOTOS_REQUIRED",
  "WRONG_ACCOUNT",
]);

/**
 * What a failed money request's error says about it:
 * - "refused": the wallet read it and said no, so nothing was made;
 * - "unread": turned away before the wallet read it (signed out, a sign-up step owed, timed
 *   out, rate-limited), so nothing about this send, nor about any earlier one;
 * - "unknown": no answer (a dropped connection or a server error), so it may have gone through.
 */
export type TransferFailure = "refused" | "unread" | "unknown";

/**
 * Unanswered money requests, kept per member across reloads and visits until they're
 * answered, so a retry reuses their key: the server returns the one it made, or makes it once.
 */
export const pendingTransfersService = {
  /**
   * Runs `work` while no other tab of this browser is sending this member's money requests
   * (Web Locks): a request is never sent, kept or settled by two tabs at once, and each send
   * decides from the kept copies as they are once it holds the lock. Where the browser has no
   * Web Locks, it just runs.
   */
  exclusive<T>(memberId: string, work: () => Promise<T>): Promise<T> {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    // The lock resolves with what `work` returned: its promise, unwrapped.
    return locks ? locks.request(`kinkord:wallet:${memberId}`, work).then((done) => done) : work();
  },
  failure(e: unknown): TransferFailure {
    if (!(e instanceof ApiError)) return "unknown";
    const code = (e.body as { code?: unknown } | null)?.code;
    // Switched off: a definite "no", before anything was read or moved.
    if (code === "WALLET_DISABLED") return "refused";
    if (e.status === 0 || e.status >= 500) return "unknown";
    if ([401, 408, 429].includes(e.status) || (typeof code === "string" && UNREAD_CODES.has(code)))
      return "unread";
    return e.status >= 400 ? "refused" : "unknown";
  },
  /** Null when storage can't be read: then there's no telling what's kept. */
  withdrawals: (memberId: string): UnansweredWithdrawal[] | null => store.withdrawals(memberId),
  /** True once kept; false when this browser couldn't keep it. */
  keepWithdrawal: (memberId: string, request: UnansweredWithdrawal) =>
    store.keepWithdrawal(memberId, request),
  settleWithdrawal: (memberId: string, key: string) => store.settleWithdrawal(memberId, key),
  /** Null when storage can't be read: then there's no telling what's kept. */
  gifts: (memberId: string): GiftInDoubt[] | null => store.gifts(memberId),
  /** True once kept; false when this browser couldn't keep it. */
  keepGift: (memberId: string, gift: GiftInDoubt) => store.keepGift(memberId, gift),
  settleGift: (memberId: string, key: string) => store.settleGift(memberId, key),
};
