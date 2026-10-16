export type KinkCurrency = "coin" | "star" | "crown";

export interface CurrencyPackPM {
  quantity: number;
  priceCents: number;
  badge?: string;
}

export interface CurrencyPM {
  kind: KinkCurrency;
  name: string;
  plural: string;
  description: string;
  unitPriceCents: number;
  packs: CurrencyPackPM[];
}

export interface CurrencyVM extends Omit<CurrencyPM, "packs" | "unitPriceCents"> {
  unitPrice: string;
  packs: Array<{ quantity: string; price: string; badge: string | null }>;
}

export interface CoinBalanceVM {
  amount: string;
  label: string;
  status: string;
  description: string;
}

/** Reference pricing only; transactions remain unavailable in this UI preview. */
export function currencyToVM(currency: CurrencyPM): CurrencyVM {
  const price = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: cents % 100 ? 2 : 0,
    }).format(cents / 100);
  return {
    ...currency,
    unitPrice: `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(currency.unitPriceCents / 100)} each`,
    packs: currency.packs.map((pack) => ({
      quantity: pack.quantity.toLocaleString("en-US"),
      price: price(pack.priceCents),
      badge: pack.badge ?? null,
    })),
  };
}
