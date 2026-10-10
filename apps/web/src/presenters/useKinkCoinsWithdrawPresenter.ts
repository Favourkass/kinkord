"use client";
import { useEffect, useState } from "react";
import type { BankAccountPM } from "@/domain/bankAccount";
import { bankAccountsService } from "@/services/bankAccounts.service";
import type { KinkCurrency } from "@/domain/kinkcoins";
import { kinkcoinsWithdrawService } from "@/services/kinkcoins-withdraw.service";

type Step = "options" | "confirm" | "processing";
export function useKinkCoinsWithdrawPresenter(user = "") {
  const [bankAccounts, setBankAccounts] = useState<BankAccountPM[]>(() =>
    bankAccountsService.read(user),
  );
  const [bankId, setBankId] = useState<string | null>(
    () => bankAccounts.find((account) => account.isDefault)?.id ?? bankAccounts[0]?.id ?? null,
  );
  const [owner, setOwner] = useState(user);
  if (owner !== user) {
    const accounts = bankAccountsService.read(user);
    setOwner(user);
    setBankAccounts(accounts);
    setBankId(accounts.find((account) => account.isDefault)?.id ?? accounts[0]?.id ?? null);
  }
  const bankOptions = bankAccountsService.view(bankAccounts).accounts;
  const bank = bankOptions.find((account) => account.id === bankId);
  const [step, setStep] = useState<Step>("options");
  const [selectedKind, setSelectedKind] = useState<KinkCurrency | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);
  const vm = kinkcoinsWithdrawService.options();
  const confirmation = selectedKind ? kinkcoinsWithdrawService.confirmation(selectedKind) : null;
  return {
    ...vm,
    bankOptions,
    bankId: bankId ?? "",
    bankDetails: {
      name: bank?.bank ?? vm.copy.bank,
      account: bank?.detail ?? vm.copy.account,
      label: bank ? vm.copy.preview : vm.copy.saved,
    },
    onBankChange: (id: string) => {
      if (bankAccounts.some((account) => account.id === id)) setBankId(id);
    },
    step,
    title: vm.copy.titles[step],
    confirmation,
    onRedeem: (kind: KinkCurrency) => {
      if (!kinkcoinsWithdrawService.confirmation(kind)) return;
      setSelectedKind(kind);
      setStep("confirm");
    },
    onBack: () => {
      setStep("options");
      setSelectedKind(null);
    },
    onConfirm: () => {
      if (step === "confirm" && confirmation) setStep("processing");
    },
  };
}
