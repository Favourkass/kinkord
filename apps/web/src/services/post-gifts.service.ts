import type { KinkCurrency } from "@/domain/kinkcoins";
import type { WalletOperationPM, WalletSummaryPM } from "@/domain/wallet";
import { api } from "./apiClient";
export const GIFT_COPY = {
  title: "Send a gift",
  earlierSent: "Your earlier gift went through.",
  answeredElsewhere: "That gift was answered in another tab. Check Transaction History.",
  otherAccount:
    "You're signed in as someone else now. Sign back in to the account that sent this gift to check it.",
  earlierUnconfirmed:
    "Your earlier gift isn't confirmed yet. Check your connection, then try again.",
  currency: "Choose currency",
  amount: "Amount",
  close: "Cancel",
  loading: "Loading your balance…",
  sending: "Sending…",
  buy: "Buy more",
  notice: "Your gift goes directly to the post author's wallet. Gifts cannot be undone.",
  unavailable: "Wallet transactions are currently unavailable.",
  self: "You cannot send a gift to yourself.",
  labels: { coin: "Coins", star: "Stars", crown: "Crowns" },
};
const unit = (quantity: string, currency: KinkCurrency) =>
  Number(quantity) === 1
    ? { coin: "Coin", star: "Star", crown: "Crown" }[currency]
    : GIFT_COPY.labels[currency];
export const postGiftsService = {
  balance: () => api.get<WalletSummaryPM>("/wallet"),
  /** `senderId`: who the app sends as; the API refuses it if someone else is signed in now. */
  send: (
    postId: string,
    currency: KinkCurrency,
    quantity: number,
    requestKey: string,
    senderId: string,
  ) =>
    api.post<WalletOperationPM>("/wallet/gifts", {
      postId,
      currency,
      quantity,
      requestKey,
      senderId,
    }),
  quote: (summary: WalletSummaryPM | null, currency: KinkCurrency, raw: string) => {
    const available = summary?.balances.find((b) => b.currency === currency)?.available ?? 0;
    const quantity = Number(raw);
    const valid =
      !!summary?.settings.enabled &&
      /^[1-9]\d*$/.test(raw) &&
      Number.isSafeInteger(quantity) &&
      quantity <= 1_000_000 &&
      quantity <= available;
    return { available, quantity, valid };
  },
  availableLabel: (available: number, currency: KinkCurrency) =>
    `Available: ${available.toLocaleString()} ${GIFT_COPY.labels[currency]}`,
  confirmLabel: (quantity: string, currency: KinkCurrency, name: string) =>
    `Send ${quantity || "0"} ${unit(quantity, currency)} to ${name}`,
  sentLabel: (quantity: string, currency: KinkCurrency, name: string) =>
    `Sent ${quantity} ${unit(quantity, currency)} to ${name}.`,
};
