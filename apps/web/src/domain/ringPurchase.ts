import { naira, usd, planDate, type PaymentPM } from "./subscription";
export interface RingQuotePM {
  userId: string;
  quantity: number;
  /** What 2 rings cost now, in US cents; absent from an API that predates the founders' price. */
  pairUsdCents?: number;
  usdCents: number;
  amountKobo: number;
  coins: number | null;
  coinBalance: number;
  availableRings: number;
  bankAvailable: boolean;
}
export interface RingCheckoutPM {
  senderId: string;
  quantity: number;
  method: "bank" | "coins";
  requestKey: string;
  expectedAmountKobo: number;
  expectedCoins: number | null;
}
export function ringPurchaseSummary(p: PaymentPM) {
  return {
    title: `${p.ringQuantity} Kink Rings`,
    amount: p.method === "coins" ? `${p.coinQuantity} KinkCoins` : naira(p.amountKobo),
    usd: usd(p.usdCents),
    reference: p.reference,
    date: planDate(p.submittedAt ?? p.createdAt),
    status: {
      pending: "Awaiting payment",
      submitted: "Pending Verification",
      verified: "Completed",
      rejected: "Rejected",
      expired: "Expired",
    }[p.status],
    ringExpiry:
      p.status === "verified" && p.reviewedAt
        ? planDate(new Date(new Date(p.reviewedAt).getTime() + 90 * 86_400_000).toISOString())
        : null,
  };
}
