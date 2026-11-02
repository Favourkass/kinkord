import { api } from "./apiClient";
import type { RingCheckoutPM, RingQuotePM } from "@/domain/ringPurchase";
import type { PaymentPM } from "@/domain/subscription";
export const ringPurchaseService = {
  quote: (quantity: number) =>
    api.get<RingQuotePM>(`/kink-rings/purchase-quote?quantity=${quantity}`),
  checkout: (input: RingCheckoutPM) => api.post<PaymentPM>("/kink-rings/checkout", input),
  history: (page = 1) =>
    api.get<{ items: PaymentPM[]; nextPage: number | null }>(`/kink-rings/purchases?page=${page}`),
};

/** Keep ambiguous requests across refresh so the same key is retried, never charged again. */
const pendingKey = (member: string) => `kinkord:ring-purchase:${member}`;
export const pendingRingPurchase = {
  read(member: string): RingCheckoutPM | null {
    try {
      const p = JSON.parse(sessionStorage.getItem(pendingKey(member)) ?? "null");
      return p?.senderId === member &&
        typeof p.requestKey === "string" &&
        /^[-0-9a-f]{36}$/i.test(p.requestKey) &&
        Number.isInteger(p.quantity) &&
        p.quantity >= 2 &&
        p.quantity <= 100 &&
        p.quantity % 2 === 0 &&
        Number.isSafeInteger(p.expectedAmountKobo) &&
        p.expectedAmountKobo > 0 &&
        (p.expectedCoins === null ||
          (Number.isSafeInteger(p.expectedCoins) && p.expectedCoins > 0)) &&
        ["bank", "coins"].includes(p.method)
        ? p
        : null;
    } catch {
      return null;
    }
  },
  save(input: RingCheckoutPM) {
    sessionStorage.setItem(pendingKey(input.senderId), JSON.stringify(input));
  },
  clear(member: string) {
    try {
      sessionStorage.removeItem(pendingKey(member));
    } catch {
      /* A stale key is safe to replay. */
    }
  },
};
