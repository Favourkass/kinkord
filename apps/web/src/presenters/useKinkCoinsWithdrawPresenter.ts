"use client";
import { useEffect, useState } from "react";
import type { KinkCurrency } from "@/domain/kinkcoins";
import { kinkcoinsWithdrawService } from "@/services/kinkcoins-withdraw.service";

type Step = "options" | "confirm" | "processing";
export function useKinkCoinsWithdrawPresenter() {
  const [step, setStep] = useState<Step>("options");
  const [selectedKind, setSelectedKind] = useState<KinkCurrency | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);
  const vm = kinkcoinsWithdrawService.options();
  const confirmation = selectedKind ? kinkcoinsWithdrawService.confirmation(selectedKind) : null;
  return {
    ...vm,
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
