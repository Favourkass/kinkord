import { Routes } from "@/constants/Routes";
import {
  KINKCOINS_COPY,
  KINKCOINS_OVERVIEW_COPY,
  KINKCOINS_HISTORY_COPY,
  KINK_CURRENCIES,
} from "@/constants/kinkcoins";
import { currencyToVM } from "@/domain/kinkcoins";

/** UI-only catalogue: no checkout, credits or device-local spendable balances. */
export const kinkcoinsService = {
  history: () => ({
    copy: KINKCOINS_HISTORY_COPY,
    walletHref: Routes.kinkcoins,
    buyHref: Routes.kinkcoinsBuy,
  }),
  overview: () => ({
    copy: KINKCOINS_OVERVIEW_COPY,
    balances: [
      { kind: "coin" as const, label: "Coins", amount: "0" },
      { kind: "star" as const, label: "Stars", amount: "0" },
      { kind: "crown" as const, label: "Crowns", amount: "0" },
    ],
    actions: KINKCOINS_OVERVIEW_COPY.actions.map((action) => ({
      ...action,
      href:
        action.kind === "banks"
          ? Routes.kinkcoinsBanks
          : action.kind === "buy"
            ? Routes.kinkcoinsBuy
            : action.kind === "history"
              ? Routes.kinkcoinsHistory
              : action.kind === "withdraw"
                ? Routes.kinkcoinsWithdraw
                : null,
      status:
        action.kind === "banks" ||
        action.kind === "buy" ||
        action.kind === "history" ||
        action.kind === "withdraw"
          ? null
          : KINKCOINS_COPY.comingSoon,
    })),
  }),
  preview: () => ({
    copy: KINKCOINS_COPY,
    currencies: KINK_CURRENCIES.map(currencyToVM),
    balance: KINKCOINS_COPY.profileBalance,
    purchasesEnabled: false as const,
  }),
  profileBalance: (available?: number) =>
    available === undefined
      ? KINKCOINS_COPY.profileBalance
      : {
          amount: available.toLocaleString("en-NG"),
          label: "KinkCoins",
          status: "Available",
          description: "Available coins. Coins reserved for withdrawals are excluded.",
        },
};
