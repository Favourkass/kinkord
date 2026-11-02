"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ringPurchaseSummary } from "@/domain/ringPurchase";
import { RING_PAYMENT_STATES } from "@/constants/ringPurchase";
import { Routes } from "@/constants/Routes";
import { SUBSCRIPTION_COPY } from "@/constants/subscription";
import {
  bankBadge,
  countdown,
  naira,
  savePercent,
  takesProof,
  usd,
  type PaymentPM,
  type PlanPeriod,
  type PlanPricesPM,
} from "@/domain/subscription";
import { subscriptionService } from "@/services/subscription.service";
import { planOptions } from "./useSubscriptionPresenter";

export type CopyTarget = "amount" | "accountName" | "accountNumber" | "reference";

/**
 * pay: the countdown is running. expired: it ran out but proof is still
 * taken. Otherwise the payment is out of the member's hands, and the screen
 * says where it stands.
 */
export type PaymentView = "pay" | "expired" | "submitted" | "verified" | "rejected" | "lapsed";

const COPIED_MS = 2000;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export interface PaymentNoticeVM {
  tone: "info" | "success" | "problem";
  title: string;
  body: string;
}

/** What to say once a payment is out of the member's hands; null while it still takes proof. */
export function paymentNotice(
  view: PaymentView | null,
  reviewNote: string | null,
  rings = false,
): PaymentNoticeVM | null {
  const state = SUBSCRIPTION_COPY.state;
  switch (view) {
    case "submitted":
      return rings ? RING_PAYMENT_STATES.submitted : { tone: "info", ...state.submitted };
    case "verified":
      return rings ? RING_PAYMENT_STATES.verified : { tone: "success", ...state.verified };
    case "rejected":
      return {
        tone: "problem",
        title: state.rejected.title,
        body: state.rejected.body(reviewNote ?? ""),
      };
    case "lapsed":
      return { tone: "problem", ...state.expired };
    default:
      return null;
  }
}

export function paymentView(payment: PaymentPM, now: Date): PaymentView {
  if (payment.status === "submitted") return "submitted";
  if (payment.status === "verified") return "verified";
  if (payment.status === "rejected") return "rejected";
  if (!takesProof(payment, now)) return "lapsed";
  return now < new Date(payment.expiresAt) ? "pay" : "expired";
}

/** Bank transfer (Figma 46:2 mobile, 46:135 desktop): the exact amount, where to send it, the clock. */
export function usePaymentPresenter(id: string) {
  const router = useRouter();
  const copy = SUBSCRIPTION_COPY.pay;
  const [payment, setPayment] = useState<PaymentPM | null>(null);
  const [prices, setPrices] = useState<PlanPricesPM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [switching, setSwitching] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([subscriptionService.payment(id), subscriptionService.status()]).then(
      ([p, s]) => {
        if (!live) return;
        setPayment(p);
        setPrices(s.prices);
      },
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(tick);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (payment?.status !== "submitted") return;
    let live = true;
    const timer = setInterval(() => {
      void subscriptionService
        .payment(id)
        .then((p) => {
          if (live) setPayment(p);
        })
        .catch(() => undefined);
    }, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id, payment?.status]);

  /** Another plan is another payment: the server makes it, and this screen moves to it. */
  const startOver = useCallback(
    async (period: PlanPeriod) => {
      setSwitching(true);
      setError(null);
      try {
        const next = await subscriptionService.checkout(period);
        setConfirmed(false);
        if (next.id === id) setPayment(next);
        else router.replace(Routes.subscriptionPay(next.id));
      } catch (e) {
        setError(messageOf(e));
      } finally {
        setSwitching(false);
      }
    },
    [id, router],
  );

  const copyValue = useCallback(async (target: CopyTarget, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // No clipboard here (an old browser, an insecure page): the text can still be selected.
    }
    setCopied(target);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), COPIED_MS);
  }, []);

  const view = payment ? paymentView(payment, now) : null;
  const isRings = payment?.purpose === "rings";
  const notice = paymentNotice(view, payment?.reviewNote ?? null, isRings);
  const canSwitch = (view === "pay" || view === "expired") && !switching;
  const copyLabel = (t: CopyTarget) => (copied === t ? copy.copied : copy.copy);

  return {
    loading: payment === null && error === null,
    error,
    view,
    ringSummary: isRings && payment ? ringPurchaseSummary(payment) : null,
    ringHero: "/kink-rings/gift-box.webp",
    backHref: isRings ? Routes.kinkRings : Routes.subscription,
    plans:
      payment && prices && !isRings
        ? planOptions(prices, payment.period).map((o) => ({
            ...o,
            save:
              o.period === "yearly" && savePercent(prices) > 0
                ? copy.savePill(savePercent(prices))
                : null,
          }))
        : [],
    selectPlan: (p: PlanPeriod) => {
      if (canSwitch && payment && p !== payment.period) void startOver(p);
    },
    switching,
    countdown: payment ? countdown(new Date(payment.expiresAt).getTime() - now.getTime()) : "",
    amount: payment
      ? {
          value: naira(payment.amountKobo),
          usd: copy.usdApprox(usd(payment.usdCents)),
          copyLabel: copyLabel("amount"),
          onCopy: () => void copyValue("amount", String(payment.amountKobo / 100)),
        }
      : null,
    bank: payment
      ? {
          badge: bankBadge(payment.bank.name),
          name: payment.bank.name,
          accountName: payment.bank.accountName,
          accountNumber: payment.bank.accountNumber,
          copyAccountName: {
            label: copyLabel("accountName"),
            onCopy: () => void copyValue("accountName", payment.bank.accountName),
          },
          copyAccountNumber: {
            label: copyLabel("accountNumber"),
            onCopy: () => void copyValue("accountNumber", payment.bank.accountNumber),
          },
        }
      : null,
    reference: payment
      ? {
          value: payment.reference,
          copyLabel: copyLabel("reference"),
          onCopy: () => void copyValue("reference", payment.reference),
        }
      : null,
    /** Where the payment stands once it's out of the member's hands. */
    notice,
    confirmed,
    toggleConfirmed: () => setConfirmed((c) => !c),
    canContinue: view === "pay" && confirmed,
    proceed: () => router.push(Routes.subscriptionProof(id)),
    restart: () => {
      if (isRings) {
        router.push(Routes.kinkRingsBuy);
        return;
      }
      if (payment) void startOver(payment.period);
    },
  };
}
