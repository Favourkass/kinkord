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
  enabled: boolean;
  rates: Record<KinkCurrency, { buy: number; redeem: number }> | null;
  minimumKobo: number | null;
  bank: { name: string; accountName: string; accountNumber: string } | null;
  packs: Record<KinkCurrency, number[]>;
  canEdit?: boolean;
}
export interface WalletSummaryPM {
  settings: WalletSettingsPM;
  balances: Array<{ currency: KinkCurrency; available: number; reserved: number }>;
}
export interface WalletOperationPM {
  id: string;
  userId: string;
  kind: "purchase" | "withdrawal";
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
    amount: walletMoney(row.amountKobo),
    quantityLabel: row.quantity.toLocaleString("en-NG"),
    date: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(row.createdAt),
    ),
    maskedAccount: `•••• ${row.accountNumber.slice(-4)}`,
    statusLabel: {
      pending: "Awaiting action",
      submitted: "Awaiting payment verification",
      verified: "Payment verified",
      approved: "Approved · awaiting transfer",
      paid: "Paid",
      rejected: "Rejected",
    }[row.status],
  };
}
