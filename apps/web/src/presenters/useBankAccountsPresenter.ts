"use client";
import { useState } from "react";
import type { BankAccountPM } from "@/domain/bankAccount";
import { bankAccountsService, type BankAccountInput } from "@/services/bankAccounts.service";
const empty: BankAccountInput = { bank: "", holder: "", number: "", type: "Savings" };
export function useBankAccountsPresenter(user: string) {
  const [accounts, setAccounts] = useState<BankAccountPM[]>(() => bankAccountsService.read(user));
  const [form, setForm] = useState<BankAccountInput>(empty);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [owner, setOwner] = useState(user);
  if (owner !== user) {
    setOwner(user);
    setAccounts(bankAccountsService.read(user));
    setForm(empty);
    setError(null);
    setStatus(null);
  }
  const vm = bankAccountsService.view(accounts);
  const update = (key: keyof BankAccountInput, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError(null);
    setStatus(null);
  };
  const run = (action: () => BankAccountPM[], message: string) => {
    try {
      setAccounts(action());
      setError(null);
      setStatus(message);
      return true;
    } catch (e) {
      setStatus(null);
      setError(
        e instanceof Error && e.message === vm.copy.invalid ? e.message : vm.copy.storageError,
      );
      return false;
    }
  };
  return {
    ...vm,
    form,
    error,
    status,
    ready: !!user,
    onChange: update,
    onSave: () => {
      if (run(() => bankAccountsService.add(user, form), vm.copy.saved)) setForm(empty);
    },
    onDefault: (id: string) => run(() => bankAccountsService.setDefault(user, id), vm.copy.updated),
    onRemove: (id: string) => run(() => bankAccountsService.remove(user, id), vm.copy.removed),
  };
}
