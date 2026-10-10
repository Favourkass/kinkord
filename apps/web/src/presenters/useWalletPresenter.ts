"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { walletOperationVM, type WalletMode, type WalletOperationPM } from "@/domain/wallet";
import type { KinkCurrency } from "@/domain/kinkcoins";
import { bankBadge } from "@/domain/subscription";
import { banksService } from "@/services/banks.service";

/** A bank from the directory, with the initials badge it shows in place of a logo. */
const withBadge = <T extends { name: string }>(bank: T) => ({
  ...bank,
  badge: bankBadge(bank.name),
});
import { walletService, type WalletDataPM } from "@/services/wallet.service";
export function useWalletPresenter(mode: WalletMode, paymentId?: string) {
  const router = useRouter();
  const [data, setData] = useState<WalletDataPM | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<WalletOperationPM | null>(null),
    [review, setReview] = useState(false),
    [currency, setCurrency] = useState<KinkCurrency>("coin"),
    [quantity, setQuantity] = useState(""),
    [bankId, setBankId] = useState("");
  const [bankForm, setBankForm] = useState({ bankName: "", accountName: "", accountNumber: "" }),
    [proof, setProof] = useState({ senderAccountName: "", senderReference: "" }),
    [file, setFile] = useState<File | null>(null);
  const [bankPickerOpen, setBankPickerOpen] = useState(false),
    [bankSearch, setBankSearch] = useState("");
  const running = useRef(false),
    keys = useRef(new Map<string, string>());
  const [unanswered, setUnanswered] = useState<string | null>(null);
  const keyFor = (value: string) => {
    const existing = keys.current.get(value);
    if (existing) return existing;
    const next = crypto.randomUUID();
    keys.current.set(value, next);
    return next;
  };
  const refresh = async () => {
    const next = await walletService.load();
    setData(next);
    return next;
  };
  useEffect(() => {
    let live = true;
    const read = async () => {
      try {
        const next = await walletService.load();
        const payment = paymentId ? await walletService.operation(paymentId) : null;
        if (!live) return;
        setData(next);
        if (payment) setOperation(payment);
        setBankId(
          (previous) =>
            previous || next.banks.find((bank) => bank.isDefault)?.id || next.banks[0]?.id || "",
        );
        setError(null);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not load wallet.");
      } finally {
        if (live) setLoading(false);
      }
    };
    void read();
    const interval = setInterval(() => void read(), 15000);
    const focus = () => void read();
    window.addEventListener("focus", focus);
    return () => {
      live = false;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [paymentId]);
  const vm = walletService.view(mode, data);
  const run = async (work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const chosenBank = banksService.find(bankForm.bankName);
  const withdrawal = `withdraw:${currency}:${quantity}:${bankId}`;
  // Sent but unanswered (a lost response): it may have gone through, reserving the coins, so
  // the same request can be sent again even when the balance no longer covers it. The server
  // answers with the withdrawal it already made, or refuses.
  const retrying = unanswered === withdrawal;
  const quote = walletService.withdrawalQuote(
    data?.summary.settings ?? null,
    currency,
    quantity,
    data?.summary.balances.find((b) => b.currency === currency)?.withdrawable ?? 0,
    bankId,
    vm.canRedeem,
  );
  return {
    ...vm,
    mode,
    loading,
    error,
    notice,
    busy,
    bankForm,
    bankPickerOpen,
    bankSearch,
    bankOptions: banksService.options(bankSearch).map(withBadge),
    selectedBankOption: chosenBank ? withBadge(chosenBank) : null,
    bankDirectoryCount: banksService.count,
    onOpenBankPicker: () => {
      setBankPickerOpen(true);
      setBankSearch("");
    },
    onCloseBankPicker: () => setBankPickerOpen(false),
    onBankSearch: setBankSearch,
    onChooseBank: (name: string) => {
      setBankForm((previous) => ({ ...previous, bankName: name }));
      setBankPickerOpen(false);
      setBankSearch("");
    },
    proof,
    fileName: file?.name ?? null,
    currency,
    quantity,
    bankId,
    review,
    quote,
    canSubmitWithdrawal: quote.valid || retrying,
    operation: operation ? walletOperationVM(operation) : null,
    selectedBank: vm.banks.find((bank) => bank.id === bankId) ?? null,
    onRefresh: () =>
      run(async () => {
        await refresh();
        if (paymentId) setOperation(await walletService.operation(paymentId));
      }),
    onBuy: (kind: KinkCurrency, count: number) =>
      run(async () => {
        const payment = await walletService.buy(kind, count, keyFor(`purchase:${kind}:${count}`));
        keys.current.delete(`purchase:${kind}:${count}`);
        router.push(Routes.kinkcoinsPay(payment.id));
      }),
    onBankField: (field: keyof typeof bankForm, value: string) =>
      setBankForm((previous) => ({ ...previous, [field]: value })),
    onSaveBank: () =>
      run(async () => {
        const banks = await walletService.addBank(bankForm);
        setData((previous) => (previous ? { ...previous, banks } : null));
        setBankForm({ bankName: "", accountName: "", accountNumber: "" });
        setNotice(vm.copy.saved);
      }),
    onDefaultBank: (id: string) =>
      run(async () => {
        const banks = await walletService.defaultBank(id);
        setData((previous) => (previous ? { ...previous, banks } : null));
        setNotice(vm.copy.defaultUpdated);
      }),
    onRemoveBank: (id: string) =>
      run(async () => {
        const banks = await walletService.removeBank(id);
        setData((previous) => (previous ? { ...previous, banks } : null));
        setNotice(vm.copy.bankRemoved);
      }),
    onRedeem: (kind: KinkCurrency) => {
      setCurrency(kind);
      setQuantity(walletService.minimumQuantity(data?.summary.settings ?? null, kind));
      setReview(true);
      setOperation(null);
      setError(null);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    onQuantity: setQuantity,
    onBank: setBankId,
    onCancel: () => setReview(false),
    onWithdraw: () =>
      run(async () => {
        if (!quote.valid && !retrying)
          throw new Error(
            "Check the quantity, withdrawable balance, minimum and selected bank account.",
          );
        setUnanswered(withdrawal);
        const result = await walletService.withdraw(
          currency,
          Number(quantity),
          bankId,
          keyFor(withdrawal),
        );
        keys.current.delete(withdrawal);
        setUnanswered(null);
        setOperation(result);
        setReview(false);
        await refresh();
        window.scrollTo({ top: 0, behavior: "instant" });
      }),
    onProofField: (field: keyof typeof proof, value: string) =>
      setProof((previous) => ({ ...previous, [field]: value })),
    onFile: setFile,
    onSubmitProof: () =>
      run(async () => {
        if (!operation || !file) throw new Error("Choose a receipt first.");
        setOperation(
          await walletService.submitProof(
            operation.id,
            file,
            proof.senderAccountName,
            proof.senderReference,
          ),
        );
        setFile(null);
        await refresh();
      }),
  };
}
