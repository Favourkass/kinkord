import type { KinkCurrency } from "./kinkcoins";
export type WalletMode = "overview" | "buy" | "history" | "banks" | "withdraw" | "pay";
export type WalletStatus = "pending" | "submitted" | "verified" | "approved" | "paid" | "rejected";
export interface WalletBankPM {
  id: string;
  userId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isDefault: number;
  createdAt: string;
}
export interface WalletSettingsPM {
  currency: "NGN";
  /** Shared configured NGN/USD conversion from Silver payment settings. */
  usdConversion?: { kobo: number; usdCents: number } | null;
  enabled: boolean;
  rates: Record<KinkCurrency, { buy: number; redeem: number }> | null;
  minimumKobo: number | null;
  bank: { name: string; accountName: string; accountNumber: string } | null;
  packs: Record<KinkCurrency, number[]>;
  canEdit?: boolean;
  /** Whether this admin may credit coins and approve payouts: the founders only. */
  canDecide?: boolean;
}
export interface WalletSummaryPM {
  /** Whose wallet this is. Absent from an older API. */
  userId?: string;
  redemption?: { canRedeem: boolean; reason: string | null };
  settings: WalletSettingsPM;
  balances: Array<{
    currency: KinkCurrency;
    available: number;
    reserved: number;
    /** What can be withdrawn: coins received as gifts. Absent from an older API. */
    withdrawable?: number;
  }>;
}
export interface WalletOperationPM {
  id: string;
  userId: string;
  kind: "purchase" | "withdrawal" | "gift_sent" | "gift_received";
  counterpartyName?: string;
  postId?: string;
  currency: KinkCurrency;
  quantity: number;
  amountKobo: number;
  status: WalletStatus;
  reference: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  receiptKey: string | null;
  receiptUrl?: string | null;
  senderReference: string | null;
  senderAccountName: string | null;
  reviewNote: string | null;
  settlementReference: string | null;
  createdAt: string;
  updatedAt: string;
}
export const walletMoney = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
export function walletBankVM(bank: WalletBankPM) {
  return {
    ...bank,
    maskedNumber: `•••• ${bank.accountNumber.slice(-4)}`,
    default: bank.isDefault === 1,
  };
}
export function walletOperationVM(row: WalletOperationPM) {
  return {
    ...row,
    amount:
      row.kind === "gift_sent" || row.kind === "gift_received"
        ? `${row.kind === "gift_sent" ? "−" : "+"}${row.quantity.toLocaleString("en-NG")}`
        : walletMoney(row.amountKobo),
    title: {
      purchase: "Coin purchase",
      withdrawal: "Withdrawal",
      gift_sent: "Gift sent",
      gift_received: "Gift received",
    }[row.kind],
    counterpartyLabel: row.counterpartyName
      ? `${row.kind === "gift_sent" ? "To" : "From"} ${row.counterpartyName}`
      : null,
    quantityLabel: row.quantity.toLocaleString("en-NG"),
    date: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(row.createdAt),
    ),
    maskedAccount: `•••• ${row.accountNumber.slice(-4)}`,
    statusLabel:
      row.kind === "gift_sent" || row.kind === "gift_received"
        ? "Completed"
        : {
            pending: "Awaiting action",
            submitted: "Awaiting payment verification",
            verified: "Payment verified",
            approved: "Approved · awaiting transfer",
            paid: "Paid",
            rejected: "Rejected",
          }[row.status],
  };
}

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
