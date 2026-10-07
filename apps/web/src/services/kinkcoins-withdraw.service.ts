import { Routes } from "@/constants/Routes";
import { KINKCOINS_REDEMPTION_SAMPLES, KINKCOINS_WITHDRAW_COPY } from "@/constants/kinkcoins";
import type { KinkCurrency } from "@/domain/kinkcoins";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const minimumCents = 10000;

/** Isolated sample data for design review; this service never sends a request or changes balances. */
export const kinkcoinsWithdrawService = {
  options: () => ({
    copy: KINKCOINS_WITHDRAW_COPY,
    walletHref: Routes.kinkcoins,
    homeHref: Routes.appHome,
    currencies: KINKCOINS_REDEMPTION_SAMPLES.map((currency) => ({
      kind: currency.kind,
      label: currency.label,
      balance: currency.balance.toLocaleString("en-US"),
      rate: `1 ${currency.kind === "coin" ? "Coin" : currency.kind === "star" ? "Star" : "Crown"} = ${money(currency.rateCents)}`,
      value: money(currency.balance * currency.rateCents),
      eligible: currency.balance * currency.rateCents >= minimumCents,
      redeem: `Redeem ${currency.label}`,
    })),
  }),
  confirmation: (kind: KinkCurrency) => {
    const currency = KINKCOINS_REDEMPTION_SAMPLES.find((item) => item.kind === kind);
    if (!currency || currency.balance * currency.rateCents < minimumCents) return null;
    const quantity = Math.ceil(minimumCents / currency.rateCents);
    return {
      kind,
      label: `${currency.label} to Redeem`,
      quantity: quantity.toLocaleString("en-US"),
      amount: money(quantity * currency.rateCents),
      fee: money(0),
    };
  },
};
