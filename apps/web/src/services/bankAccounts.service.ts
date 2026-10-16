import { KINKCOINS_BANK_COPY } from "@/constants/kinkcoins";
import { Routes } from "@/constants/Routes";
import { bankAccountToVM, type BankAccountPM } from "@/domain/bankAccount";
import { bankAccountsRepository } from "@/repositories/bankAccounts.repository";
export interface BankAccountInput {
  bank: string;
  holder: string;
  number: string;
  type: "Savings" | "Current";
}
export const bankAccountsService = {
  read: (user: string) => bankAccountsRepository.read(user),
  view: (accounts: BankAccountPM[]) => ({
    copy: KINKCOINS_BANK_COPY,
    walletHref: Routes.kinkcoins,
    accounts: accounts.map(bankAccountToVM),
  }),
  add(user: string, input: BankAccountInput) {
    const bank = input.bank.trim(),
      holder = input.holder.trim(),
      number = input.number.replace(/\s/g, "");
    if (
      bank.length < 2 ||
      bank.length > 80 ||
      holder.length < 2 ||
      holder.length > 100 ||
      !/^\d{6,20}$/.test(number) ||
      !["Savings", "Current"].includes(input.type)
    )
      throw new Error(KINKCOINS_BANK_COPY.invalid);
    const current = bankAccountsRepository.read(user);
    // Only the last four digits are retained in the UI preview.
    const accounts = [
      ...current,
      {
        id: crypto.randomUUID(),
        bank,
        holder,
        last4: number.slice(-4),
        type: input.type,
        isDefault: current.length === 0,
      },
    ];
    bankAccountsRepository.write(user, accounts);
    return accounts;
  },
  setDefault(user: string, id: string) {
    const current = bankAccountsRepository.read(user);
    if (!current.some((account) => account.id === id)) return current;
    const accounts = current.map((account) => ({ ...account, isDefault: account.id === id }));
    bankAccountsRepository.write(user, accounts);
    return accounts;
  },
  remove(user: string, id: string) {
    const accounts = bankAccountsRepository.read(user).filter((account) => account.id !== id);
    if (accounts.length && !accounts.some((account) => account.isDefault))
      accounts[0] = { ...accounts[0], isDefault: true };
    bankAccountsRepository.write(user, accounts);
    return accounts;
  },
};
