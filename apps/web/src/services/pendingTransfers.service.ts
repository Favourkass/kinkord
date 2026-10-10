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
  failure(e: unknown): TransferFailure {
    if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500) return "unknown";
    const code = (e.body as { code?: unknown } | null)?.code;
    if ([401, 408, 429].includes(e.status) || (typeof code === "string" && UNREAD_CODES.has(code)))
      return "unread";
    return e.status >= 400 ? "refused" : "unknown";
  },
  withdrawal: (memberId: string): UnansweredWithdrawal | null => store.withdrawal(memberId),
  keepWithdrawal: (memberId: string, request: UnansweredWithdrawal) =>
    store.keepWithdrawal(memberId, request),
  settleWithdrawal: (memberId: string, key: string) => store.settleWithdrawal(memberId, key),
  gift: (memberId: string): GiftInDoubt | null => store.gift(memberId),
  keepGift: (memberId: string, gift: GiftInDoubt) => store.keepGift(memberId, gift),
  settleGift: (memberId: string, key: string) => store.settleGift(memberId, key),
};
