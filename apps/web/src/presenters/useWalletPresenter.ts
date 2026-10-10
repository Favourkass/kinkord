"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
/** An unanswered withdrawal: its sender (it's only ever sent again as them), and whether this browser could keep it. */
type InDoubt = UnansweredWithdrawal & { member: string; persisted: boolean };

/**
 * This member's unanswered withdrawals: those kept in this browser, any tab's (the truth
 * across tabs: another may have settled this page's one, or kept others), and this page's
 * own when it couldn't be kept.
 */
const withdrawalsInDoubt = (owner: string, own: InDoubt | null): InDoubt[] => {
  const kept = pendingTransfersService
    .withdrawals(owner)
    .map((request) => ({ ...request, member: owner, persisted: true }));
  if (own && own.member === owner && !own.persisted && !kept.some((k) => k.key === own.key))
    kept.push(own);
  return kept;
};

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
  const [unanswered, setUnanswered] = useState<InDoubt | null>(null);
  // Unanswered requests are kept in this browser too, for this member, until answered.
  const member = data?.summary.userId ?? null;
  const keepUnanswered = (request: UnansweredWithdrawal, sender: string) => {
    const persisted = pendingTransfersService.keepWithdrawal(sender, request);
    setUnanswered({ ...request, member: sender, persisted });
  };
  const settleUnanswered = (sender: string, key: string) => {
    setUnanswered((current) => (current?.key === key ? null : current));
    pendingTransfersService.settleWithdrawal(sender, key);
  };
  /**
   * What every successful load does: the wallet, and this member's kept unanswered withdrawal
   * (a reload's, say), restored before anything new can be sent. Another account's (a switch in
   * another tab) stays kept for them.
   */
  const applyLoad = useCallback((next: WalletDataPM) => {
    setData(next);
    const owner = next.summary.userId;
    // The one shown: this page's own while it's still in doubt, else the first kept (a reload's,
    // or another tab's). Another account's (a switch in another tab) stays kept for them.
    setUnanswered((current) => {
      if (!owner) return null;
      const doubts = withdrawalsInDoubt(owner, current);
      return doubts.find((d) => d.key === current?.key) ?? doubts[0] ?? null;
    });
    // The account shown is pinned once: a default changed elsewhere doesn't move it.
    setBankId(
      (previous) =>
        previous || next.banks.find((bank) => bank.isDefault)?.id || next.banks[0]?.id || "",
    );
  }, []);
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
  }, [paymentId, applyLoad]);
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
        const own = unanswered && unanswered.member === member ? unanswered : null;
        // A new request gets its own key; a retry is exactly the request in doubt.
        const fresh = {
          currency,
          quantity,
          bankId,
          key: crypto.randomUUID(),
          expectedAmountKobo: quote.amountKobo,
        };
        // One tab at a time sends this member's money requests, deciding from the kept copies
        // as they are once it holds the lock: another tab may have settled this page's request,
        // or kept a newer one, which is then the one to send (never overwritten).
        const result = await pendingTransfersService.exclusive(member, async () => {
          const doubts = withdrawalsInDoubt(member, own);
          const inDoubt = doubts.find((d) => d.key === own?.key) ?? doubts[0] ?? null;
          if (inDoubt && inDoubt.key !== own?.key) {
            // Not what this page showed: shown first, then sent.
            setUnanswered(inDoubt);
            throw new Error(WALLET_COPY.unanswered);
          }
          if (own && !inDoubt) {
            setUnanswered(null);
            throw new Error(WALLET_COPY.settledElsewhere);
          }
          const wasUnanswered = inDoubt !== null;
          const request = inDoubt ?? fresh;
          const sender = inDoubt?.member ?? member;
          keepUnanswered(request, sender);
          try {
            const made = await walletService.withdraw(
              request.currency,
              Number(request.quantity),
              request.bankId,
              request.key,
              request.expectedAmountKobo,
              sender,
            );
            settleUnanswered(sender, request.key);
            return made;
          } catch (e) {
            // Refused: nothing was made. Unread (signed out, a sign-up step owed, timed out,
            // rate-limited): this send wasn't read, and with the lock held no other tab has
            // sent it, so a first send is settled too; an earlier one stays in doubt. No
            // answer: it may have gone through, so it's kept.
            const failure = pendingTransfersService.failure(e);
            if (failure === "refused" || (failure === "unread" && !wasUnanswered)) {
              settleUnanswered(sender, request.key);
              // A changed rate, say: show what a new request would be. If that load fails
              // too, the refusal stays on screen and the next refresh catches up.
              if (failure === "refused") void refresh().catch(() => undefined);
            }
            throw e;
          }
        });
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
