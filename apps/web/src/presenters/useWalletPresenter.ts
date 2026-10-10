"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { WALLET_COPY } from "@/constants/wallet";
import { walletOperationVM, type WalletMode, type WalletOperationPM } from "@/domain/wallet";
import type { KinkCurrency } from "@/domain/kinkcoins";
import { bankBadge } from "@/domain/subscription";
import { ApiError } from "@/services/apiClient";
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
    [picked, setBankId] = useState("");
  const [bankForm, setBankForm] = useState({ bankName: "", accountName: "", accountNumber: "" }),
    [proof, setProof] = useState({ senderAccountName: "", senderReference: "" }),
    [file, setFile] = useState<File | null>(null);
  const [bankPickerOpen, setBankPickerOpen] = useState(false),
    [bankSearch, setBankSearch] = useState("");
  const running = useRef(false),
    keys = useRef(new Map<string, string>());
  // Sent but unanswered (a lost response): it may have gone through, reserving the coins.
  // Until it's answered, it's what gets sent, exactly as it was (same account and key),
  // whatever the form says now: the server returns the withdrawal it made, or refuses.
  const [unanswered, setUnanswered] = useState<{
    currency: KinkCurrency;
    quantity: string;
    bankId: string;
    key: string;
    expectedAmountKobo: number;
  } | null>(null);
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
  // The account picked, while it's still saved: one removed (in another tab, say) falls back
  // to the default, so a withdrawal never goes to an account that's gone.
  const savedBanks = data?.banks ?? [];
  const bankId = savedBanks.some((bank) => bank.id === picked)
    ? picked
    : (savedBanks.find((bank) => bank.isDefault)?.id ?? savedBanks[0]?.id ?? "");
  const withdrawal = `withdraw:${currency}:${quantity}:${bankId}`;
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
    canSubmitWithdrawal: quote.valid || unanswered !== null,
    unansweredNotice: unanswered ? WALLET_COPY.unanswered : null,
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
        if (!unanswered && !quote.valid)
          throw new Error(
            "Check the quantity, withdrawable balance, minimum and selected bank account.",
          );
        const request = unanswered ?? {
          currency,
          quantity,
          bankId,
          key: keyFor(withdrawal),
          expectedAmountKobo: quote.amountKobo,
        };
        setUnanswered(request);
        let result: WalletOperationPM;
        try {
          result = await walletService.withdraw(
            request.currency,
            Number(request.quantity),
            request.bankId,
            request.key,
            request.expectedAmountKobo,
          );
        } catch (e) {
          // A refusal (4xx) is an answer: nothing was made, so the form decides what's sent
          // next. A dropped connection (status 0) or a server error is not: keep it.
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
            setUnanswered(null);
            // A changed rate, say: show what a new request would be. If that load fails too,
            // the refusal stays on screen and the next refresh catches up.
            void refresh().catch(() => undefined);
          }
          throw e;
        }
        keys.current.delete(`withdraw:${request.currency}:${request.quantity}:${request.bankId}`);
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
