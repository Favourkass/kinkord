import type { BankAccountPM } from "@/domain/bankAccount";
const key = (user: string) => `kinkord:bank-preview:${encodeURIComponent(user)}`;
export const bankAccountsRepository = {
  read(user: string): BankAccountPM[] {
    if (!user || typeof window === "undefined") return [];
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(key(user)) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is BankAccountPM =>
          !!item &&
          typeof item.id === "string" &&
          typeof item.bank === "string" &&
          typeof item.holder === "string" &&
          /^\d{4}$/.test(item.last4) &&
          ["Savings", "Current"].includes(item.type) &&
          typeof item.isDefault === "boolean",
      );
    } catch {
      return [];
    }
  },
  write(user: string, accounts: BankAccountPM[]) {
    if (!user) throw new Error("An account is required");
    sessionStorage.setItem(key(user), JSON.stringify(accounts));
  },
};
