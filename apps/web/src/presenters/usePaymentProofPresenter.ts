"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Routes } from "@/constants/Routes";
import { SUBSCRIPTION_COPY } from "@/constants/subscription";
import { nairaDigits, parseNaira, type PaymentPM } from "@/domain/subscription";
import { subscriptionService } from "@/services/subscription.service";
import { paymentNotice, paymentView, type PaymentView } from "./usePaymentPresenter";

interface Receipt {
  /** A local preview of the photo picked, shown while it uploads. */
  previewUrl: string;
  /** Where it landed; null until the upload finishes. */
  key: string | null;
}

const ACCOUNT_DIGITS = 10;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** The first thing missing from the proof, or null when it can go. */
export function proofProblem(input: {
  reference: string;
  amount: string;
  bank: string;
  name: string;
  number: string;
  receipt: Receipt | null;
}): string | null {
  const errors = SUBSCRIPTION_COPY.proof.errors;
  if (!input.receipt) return errors.receipt;
  if (!input.receipt.key) return errors.uploading;
  if (!input.reference.trim()) return errors.reference;
  if (parseNaira(input.amount) === null) return errors.amount;
  if (input.bank.trim().length < 2) return errors.bank;
  if (input.name.trim().length < 2) return errors.name;
  if (!new RegExp(`^\\d{${ACCOUNT_DIGITS}}$`).test(input.number)) return errors.number;
  return null;
}

/**
 * Payment proof (Figma 48:348 mobile, 48:111 desktop): the receipt, and the
 * account the money came from. The sender's account name is what the admins
 * track the payment by, so it's asked for exactly as the bank has it.
 */
export function usePaymentProofPresenter(id: string) {
  const [payment, setPayment] = useState<PaymentPM | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<PaymentPM | null>(null);
  // Only the latest pick's upload may land; a replaced or removed one is ignored.
  const uploadSeq = useRef(0);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    subscriptionService.payment(id).then(
      (p) => {
        if (!live) return;
        setPayment(p);
        setReference(p.reference);
        setAmount(nairaDigits(p.amountKobo));
      },
      (e: unknown) => live && setLoadError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [id]);

  const setPreview = useCallback((url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
  }, []);
  useEffect(() => () => setPreview(null), [setPreview]);

  const pickReceipt = useCallback(
    async (file: File) => {
      const seq = ++uploadSeq.current;
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      setReceipt({ previewUrl, key: null });
      setError(null);
      try {
        const key = await subscriptionService.uploadReceipt(id, file);
        if (seq === uploadSeq.current) setReceipt({ previewUrl, key });
      } catch (e) {
        if (seq !== uploadSeq.current) return;
        setPreview(null);
        setReceipt(null);
        setError(messageOf(e));
      }
    },
    [id, setPreview],
  );

  const removeReceipt = useCallback(() => {
    uploadSeq.current++;
    setPreview(null);
    setReceipt(null);
  }, [setPreview]);

  const submit = useCallback(async () => {
    const problem = proofProblem({ reference, amount, bank, name, number, receipt });
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      setSent(
        await subscriptionService.submit(id, {
          reference: reference.trim(),
          amountKobo: parseNaira(amount) as number,
          senderBankName: bank.trim(),
          senderAccountName: name.trim(),
          senderAccountNumber: number,
          receiptKey: receipt?.key as string,
        }),
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSubmitting(false);
    }
  }, [amount, bank, id, name, number, receipt, reference]);

  const current = sent ?? payment;
  const view: PaymentView | null = current ? paymentView(current, new Date()) : null;

  return {
    loading: payment === null && loadError === null,
    loadError,
    /** "pay" and "expired" both take proof; anything else shows where the payment stands. */
    view: view === "pay" || view === "expired" ? ("form" as const) : view,
    notice: paymentNotice(view, current?.reviewNote ?? null),
    backHref: Routes.subscriptionPay(id),
    subscriptionHref: Routes.subscription,
    reference,
    setReference,
    amount,
    setAmount: (v: string) => setAmount(v.replace(/[^\d.,]/g, "")),
    bank,
    setBank,
    name,
    setName,
    number,
    setNumber: (v: string) => setNumber(v.replace(/\D/g, "").slice(0, ACCOUNT_DIGITS)),
    receipt: receipt ? { previewUrl: receipt.previewUrl, uploading: receipt.key === null } : null,
    pickReceipt: (file: File) => void pickReceipt(file),
    removeReceipt,
    error,
    submitting,
    submit: () => void submit(),
  };
}
