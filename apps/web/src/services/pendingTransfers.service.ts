import type { KinkCurrency } from "@/domain/kinkcoins";
import { pendingTransfersRepository as store } from "@/repositories/pendingTransfers.repository";

/** A withdrawal sent but not answered: sent again exactly as it was. */
export interface UnansweredWithdrawal {
  currency: KinkCurrency;
  quantity: string;
  bankId: string;
  key: string;
  expectedAmountKobo: number;
}

/** A gift sent but not answered: sent again exactly as it was. */
export interface GiftInDoubt {
  postId: string;
  currency: KinkCurrency;
  quantity: string;
  key: string;
}

const isCurrency = (v: unknown): v is KinkCurrency => v === "coin" || v === "star" || v === "crown";
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * Unanswered money requests, kept per member across reloads and visits until they're
 * answered, so a retry reuses their key: the server returns the one it made, or makes it once.
 */
export const pendingTransfersService = {
  withdrawal(memberId: string): UnansweredWithdrawal | null {
    const v = store.read("withdrawal", memberId) as Partial<UnansweredWithdrawal> | null;
    return v &&
      isCurrency(v.currency) &&
      text(v.quantity) &&
      text(v.bankId) &&
      text(v.key) &&
      Number.isSafeInteger(v.expectedAmountKobo)
      ? (v as UnansweredWithdrawal)
      : null;
  },
  keepWithdrawal: (memberId: string, request: UnansweredWithdrawal) =>
    store.write("withdrawal", memberId, request),
  settleWithdrawal: (memberId: string) => store.clear("withdrawal", memberId),
  gift(memberId: string): GiftInDoubt | null {
    const v = store.read("gift", memberId) as Partial<GiftInDoubt> | null;
    return v && text(v.postId) && isCurrency(v.currency) && text(v.quantity) && text(v.key)
      ? (v as GiftInDoubt)
      : null;
  },
  keepGift: (memberId: string, gift: GiftInDoubt) => store.write("gift", memberId, gift),
  settleGift: (memberId: string) => store.clear("gift", memberId),
};
