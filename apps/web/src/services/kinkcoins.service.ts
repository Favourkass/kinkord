import { KINKCOINS_COPY, KINK_CURRENCIES } from "@/constants/kinkcoins";
import { currencyToVM } from "@/domain/kinkcoins";

/** UI-only catalogue: no checkout, credits or device-local spendable balances. */
export const kinkcoinsService = {
  preview: () => ({
    copy: KINKCOINS_COPY,
    currencies: KINK_CURRENCIES.map(currencyToVM),
    balance: KINKCOINS_COPY.profileBalance,
    purchasesEnabled: false as const,
  }),
  profileBalance: () => KINKCOINS_COPY.profileBalance,
};
