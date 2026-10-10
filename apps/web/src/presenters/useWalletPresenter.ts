"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { WALLET_COPY } from "@/constants/wallet";
import {
  walletMoney,
  walletOperationVM,
  type UnansweredWithdrawal,
  type WalletMode,
  type WalletOperationPM,
} from "@/domain/wallet";
import type { KinkCurrency } from "@/domain/kinkcoins";
import { bankBadge } from "@/domain/subscription";
import { banksService } from "@/services/banks.service";
import { pendingTransfersService } from "@/services/pendingTransfers.service";

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
  // With its sender: it's only ever sent again by them.
  const [unanswered, setUnanswered] = useState<(UnansweredWithdrawal & { member: string }) | null>(
    null,
  );
  // Unanswered requests are kept in this browser too, for this member, until answered.
  const member = data?.summary.userId ?? null;
  const keepUnanswered = (request: UnansweredWithdrawal, sender: string) => {
    setUnanswered({ ...request, member: sender });
    pendingTransfersService.keepWithdrawal(sender, request);
  };
  const settleUnanswered = (sender: string, key: string) => {
    setUnanswered(null);
    pendingTransfersService.settleWithdrawal(sender, key);
  };
  /**
   * What every successful load does: the wallet, and this member's kept unanswered withdrawal
   * (a reload's, say), restored before anything new can be sent. Another account's (a switch in
   * another tab) stays kept for them.
   */
  const applyLoad = (next: WalletDataPM) => {
    setData(next);
    const owner = next.summary.userId;
    const kept = owner ? pendingTransfersService.withdrawal(owner) : null;
    setUnanswered((current) =>
      current && current.member === owner
        ? current
        : kept && owner
          ? { ...kept, member: owner }
          : null,
    );
    // The account shown is pinned once: a default changed elsewhere doesn't move it.
    setBankId(
      (previous) =>
        previous || next.banks.find((bank) => bank.isDefault)?.id || next.banks[0]?.id || "",
    );
  };
  const keyFor = (value: string) => {
    const existing = keys.current.get(value);
    if (existing) return existing;
    const next = crypto.randomUUID();
    keys.current.set(value, next);
    return next;
  };
  // Every read of the wallet is numbered, and a change made here (proof sent, a withdrawal, a
  // bank account) moves the number on: a read that started before it can't land afterwards and
  // put back what it replaced.
  const reads = useRef(0);
  const supersedeReads = () => {
    reads.current += 1;
  };
  const refresh = async () => {
    const asked = ++reads.current;
    const next = await walletService.load();
    if (asked === reads.current) applyLoad(next);
    return next;
  };
  useEffect(() => {
    let live = true;
    // One background read at a time: a poll while one is still out (a slow connection) is
    // skipped, so slow reads can't keep superseding each other and nothing ever lands. It's
    // this setup's own flag, so Strict Mode's second setup still makes its first read.
    let reading = false;
    const read = async () => {
      if (reading) return;
      reading = true;
      const asked = ++reads.current;
      try {
        const next = await walletService.load();
        const payment = paymentId ? await walletService.operation(paymentId) : null;
        if (!live || asked !== reads.current) return;
        applyLoad(next);
        if (payment) setOperation(payment);
        setError(null);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not load wallet.");
      } finally {
        reading = false;
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
    // While a request is unanswered, the review shows it (what a retry sends), locked.
    currency: unanswered?.currency ?? currency,
    quantity: unanswered?.quantity ?? quantity,
    bankId: unanswered?.bankId ?? bankId,
    fieldsLocked: unanswered !== null,
    review: review || unanswered !== null,
    quote: unanswered
      ? {
          ...quote,
          amount: walletMoney(unanswered.expectedAmountKobo),
          amountKobo: unanswered.expectedAmountKobo,
        }
      : quote,
    canSubmitWithdrawal: quote.valid || unanswered !== null,
    unansweredNotice: unanswered ? WALLET_COPY.unanswered : null,
    operation: operation ? walletOperationVM(operation) : null,
    // What happened to it: a recovered request may already be approved, paid or rejected.
    operationTitle:
      operation?.status === "pending"
        ? WALLET_COPY.submitted
        : operation
          ? walletOperationVM(operation).statusLabel
          : "",
    operationNote:
      operation?.status === "approved"
        ? WALLET_COPY.approved
        : operation?.status === "paid"
          ? WALLET_COPY.paid
          : operation?.status === "rejected"
            ? (operation.reviewNote ?? WALLET_COPY.failed)
            : WALLET_COPY.processing,
    selectedBank: vm.banks.find((bank) => bank.id === (unanswered?.bankId ?? bankId)) ?? null,
    onRefresh: () =>
      run(async () => {
        await refresh();
        if (paymentId) {
          const asked = reads.current;
          const payment = await walletService.operation(paymentId);
          if (asked === reads.current) setOperation(payment);
        }
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
        supersedeReads();
        setData((previous) => (previous ? { ...previous, banks } : null));
        setBankForm({ bankName: "", accountName: "", accountNumber: "" });
        setNotice(vm.copy.saved);
      }),
    onDefaultBank: (id: string) =>
      run(async () => {
        const banks = await walletService.defaultBank(id);
        supersedeReads();
        setData((previous) => (previous ? { ...previous, banks } : null));
        setNotice(vm.copy.defaultUpdated);
      }),
    onRemoveBank: (id: string) =>
      run(async () => {
        const banks = await walletService.removeBank(id);
        supersedeReads();
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
    // An unanswered request keeps its review open: its retry lives there.
    onCancel: () => {
      if (!unanswered) setReview(false);
    },
    canCancel: unanswered === null,
    onWithdraw: () =>
      run(async () => {
        if (!unanswered && !quote.valid)
          throw new Error(
            "Check the quantity, withdrawable balance, minimum and selected bank account.",
          );
        if (!member) throw new Error(WALLET_COPY.stillLoading);
        const wasUnanswered = unanswered !== null;
        const request = unanswered ?? {
          currency,
          quantity,
          bankId,
          key: keyFor(withdrawal),
          expectedAmountKobo: quote.amountKobo,
        };
        const sender = unanswered?.member ?? member;
        keepUnanswered(request, sender);
        let result: WalletOperationPM;
        try {
          result = await walletService.withdraw(
            request.currency,
            Number(request.quantity),
            request.bankId,
            request.key,
            request.expectedAmountKobo,
            sender,
          );
        } catch (e) {
          // Refused: nothing was made, so the form decides what's sent next. Unread (signed
          // out, a sign-up step owed, timed out, rate-limited): settles a first send, never an
          // earlier one. No answer: it may have gone through, so it's kept.
          const failure = pendingTransfersService.failure(e);
          if (failure === "unread" && !wasUnanswered) settleUnanswered(sender, request.key);
          if (failure === "refused") {
            settleUnanswered(sender, request.key);
            // A changed rate, say: show what a new request would be. If that load fails too,
            // the refusal stays on screen and the next refresh catches up.
            void refresh().catch(() => undefined);
          }
          throw e;
        }
        keys.current.delete(`withdraw:${request.currency}:${request.quantity}:${request.bankId}`);
        settleUnanswered(sender, request.key);
        supersedeReads();
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
        const submitted = await walletService.submitProof(
          operation.id,
          file,
          proof.senderAccountName,
          proof.senderReference,
        );
        supersedeReads();
        setOperation(submitted);
        setFile(null);
        await refresh();
      }),
  };
}
