import { banksService } from "./banks.service";
import { Routes } from "@/constants/Routes";
import { WALLET_COPY } from "@/constants/wallet";
import type { KinkCurrency } from "@/domain/kinkcoins";
import {
  walletBankVM,
  walletMoney,
  walletOperationVM,
  type WalletBankPM,
  type WalletMode,
  type WalletOperationPM,
  type WalletSettingsPM,
  type WalletSummaryPM,
} from "@/domain/wallet";
import { compressImage, IMAGE_UPLOAD_PRESETS } from "@/util/image";
import { api, uploadToPresignedUrl } from "./apiClient";
export interface WalletDataPM {
  summary: WalletSummaryPM;
  banks: WalletBankPM[];
  history: WalletOperationPM[];
}
/** Dollar catalogue display only; checkout and settlement use the stored NGN amount. */
export function walletPurchaseUsd(kobo: number, settings: WalletSettingsPM | null, unit = false) {
  const conversion = settings?.usdConversion;
  if (!conversion || conversion.kobo <= 0 || conversion.usdCents <= 0 || !Number.isFinite(kobo))
    return "—";
  const dollars = (kobo * conversion.usdCents) / conversion.kobo / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: unit ? 4 : 2,
  }).format(dollars);
}

export const walletService = {
  load: async (): Promise<WalletDataPM> => {
    const [summary, banks, history] = await Promise.all([
      api.get<WalletSummaryPM>("/wallet"),
      api.get<WalletBankPM[]>("/wallet/banks"),
      api.get<WalletOperationPM[]>("/wallet/history"),
    ]);
    return { summary, banks, history };
  },
  operation: (id: string) =>
    api.get<WalletOperationPM>(`/wallet/operations/${encodeURIComponent(id)}`),
  buy: (currency: KinkCurrency, quantity: number, requestKey: string) =>
    api.post<WalletOperationPM>("/wallet/purchases", { currency, quantity, requestKey }),
  withdraw: (currency: KinkCurrency, quantity: number, bankId: string, requestKey: string) =>
    api.post<WalletOperationPM>("/wallet/withdrawals", { currency, quantity, bankId, requestKey }),
  addBank: (input: { bankName: string; accountName: string; accountNumber: string }) => {
    if (!banksService.find(input.bankName)) throw new Error("Choose a bank from the list.");
    return api.post<WalletBankPM[]>("/wallet/banks", input);
  },
  defaultBank: (id: string) =>
    api.put<WalletBankPM[]>(`/wallet/banks/${encodeURIComponent(id)}/default`, {}),
  removeBank: (id: string) => api.del<WalletBankPM[]>(`/wallet/banks/${encodeURIComponent(id)}`),
  submitProof: async (
    id: string,
    raw: File,
    senderAccountName: string,
    senderReference: string,
  ) => {
    const file = await compressImage(raw, IMAGE_UPLOAD_PRESETS.receipt);
    if (file.size > 10 * 1024 * 1024) throw new Error("Receipt must be no larger than 10 MB.");
    const slot = await api.post<{ key: string; uploadUrl: string }>(
      `/wallet/operations/${encodeURIComponent(id)}/receipt-upload-url`,
      { contentType: file.type, contentLength: file.size },
    );
    await uploadToPresignedUrl(slot.uploadUrl, file);
    return api.post<WalletOperationPM>(`/wallet/operations/${encodeURIComponent(id)}/submit`, {
      receiptKey: slot.key,
      senderAccountName,
      senderReference,
    });
  },
  view: (mode: WalletMode, data: WalletDataPM | null) => ({
    testMode: process.env.NEXT_PUBLIC_WALLET_TEST_MODE === "true",
    copy: WALLET_COPY,
    title: WALLET_COPY.titles[mode],
    walletHref: Routes.kinkcoins,
    homeHref: Routes.appHome,
    historyHref: Routes.kinkcoinsHistory,
    subscriptionHref: Routes.subscription,
    canRedeem: data?.summary.redemption?.canRedeem ?? false,
    redemptionReason: data?.summary.redemption?.reason ?? WALLET_COPY.redemptionRequired,
    banksHref: Routes.kinkcoinsBanks,
    actions: WALLET_COPY.actions.map((a) => ({
      ...a,
      href: {
        earn: null,
        convert: null,
        buy: Routes.kinkcoinsBuy,
        banks: Routes.kinkcoinsBanks,
        history: Routes.kinkcoinsHistory,
        withdraw: Routes.kinkcoinsWithdraw,
      }[a.key],
    })),
    bankLimit: 2,
    bankLimitReached: (data?.banks.length ?? 0) >= 2,
    enabled: data?.summary.settings.enabled ?? false,
    minimum: data?.summary.settings.minimumKobo
      ? walletMoney(data.summary.settings.minimumKobo)
      : "—",
    banks:
      data?.banks.map((bank) => ({
        ...walletBankVM(bank),
        logo: banksService.find(bank.bankName)?.logo ?? null,
      })) ?? [],
    history:
      data?.history.map((row) => ({
        ...walletOperationVM(row),
        href: row.kind === "purchase" ? Routes.kinkcoinsPay(row.id) : null,
      })) ?? [],
    currencies: (["coin", "star", "crown"] as const).map((kind) => ({
      kind,
      label: WALLET_COPY.labels[kind],
      available: data?.summary.balances.find((b) => b.currency === kind)?.available ?? 0,
      reserved: data?.summary.balances.find((b) => b.currency === kind)?.reserved ?? 0,
      redeemRate: data?.summary.settings.rates?.[kind].redeem ?? 0,
      buyRate: data?.summary.settings.rates?.[kind].buy
        ? walletPurchaseUsd(data.summary.settings.rates[kind].buy, data.summary.settings, true)
        : "—",
      packs: (data?.summary.settings.packs[kind] ?? []).map((quantity) => ({
        quantity,
        price: data?.summary.settings.rates
          ? walletPurchaseUsd(
              quantity * data.summary.settings.rates[kind].buy,
              data.summary.settings,
            )
          : "—",
      })),
    })),
  }),
  minimumQuantity: (settings: WalletSettingsPM | null, currency: KinkCurrency) =>
    settings?.rates?.[currency].redeem
      ? String(Math.ceil((settings.minimumKobo ?? 0) / settings.rates[currency].redeem))
      : "",
  withdrawalQuote: (
    settings: WalletSettingsPM | null,
    currency: KinkCurrency,
    quantity: string,
    available: number,
    bankId: string,
    canRedeem: boolean,
  ) => {
    const count = Number(quantity),
      rate = settings?.rates?.[currency].redeem ?? 0,
      amount = count * rate;
    return {
      amount: walletMoney(Number.isSafeInteger(amount) && amount >= 0 ? amount : 0),
      valid:
        canRedeem &&
        !!settings?.enabled &&
        !!bankId &&
        /^[1-9]\d*$/.test(quantity) &&
        Number.isSafeInteger(count) &&
        count <= available &&
        count <= 1_000_000 &&
        amount > 0 &&
        amount <= 1_000_000_000 &&
        amount >= (settings.minimumKobo ?? Infinity),
    };
  },
};
export const walletAdminService = {
  settings: () => api.get<WalletSettingsPM>("/admin/wallet/settings"),
  saveSettings: (input: {
    rates: NonNullable<WalletSettingsPM["rates"]>;
    minimumKobo: number;
    enabled: boolean;
  }) => api.put<WalletSettingsPM>("/admin/wallet/settings", input),
  queue: (kind: "purchase" | "withdrawal", status: string) =>
    api.get<WalletOperationPM[]>(
      `/admin/wallet?${new URLSearchParams({ kind, ...(status ? { status } : {}) })}`,
    ),
  decide: (
    id: string,
    input: {
      action: "verify" | "approve" | "reject" | "paid";
      note?: string;
      bankReference?: string;
    },
  ) => api.post<WalletOperationPM>(`/admin/wallet/${encodeURIComponent(id)}/decision`, input),
};
export function ngnToKobo(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a valid NGN amount with no more than two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result < 1 || result > 1_000_000_000)
    throw new Error("Amount is outside the supported range.");
  return result;
}
