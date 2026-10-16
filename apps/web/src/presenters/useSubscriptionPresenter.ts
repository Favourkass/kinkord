"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { SUBSCRIPTION_COPY } from "@/constants/subscription";
import {
  naira,
  planDate,
  savePercent,
  usd,
  yearlyListPrice,
  type PlanPeriod,
  type PlanPricesPM,
  type SilverCheckPM,
  type SubscriptionStatusPM,
} from "@/domain/subscription";
import { subscriptionService } from "@/services/subscription.service";

export type PlanState = "basic" | "silver" | "pending" | "review" | "rejected";

export interface PlanOptionVM {
  period: PlanPeriod;
  label: string;
  price: string;
  per: string;
  /** The naira the price comes to: "≈ ₦33,600". */
  approx: string;
  /** Twelve months at the monthly rate, struck through beside the yearly price. */
  strike: string | null;
  save: string | null;
  selected: boolean;
}

const PERIODS: PlanPeriod[] = ["monthly", "yearly"];

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** The plan cards for a set of prices, the chosen one marked. */
export function planOptions(prices: PlanPricesPM, selected: PlanPeriod): PlanOptionVM[] {
  const save = savePercent(prices);
  return PERIODS.map((period) => ({
    period,
    label: SUBSCRIPTION_COPY.periods[period],
    price: usd(prices[period].usdCents),
    per: SUBSCRIPTION_COPY.per[period],
    approx: SUBSCRIPTION_COPY.pay.approx(naira(prices[period].kobo)),
    strike: period === "yearly" && save > 0 ? usd(yearlyListPrice(prices)) : null,
    save: period === "yearly" && save > 0 ? SUBSCRIPTION_COPY.upgrade.save(save) : null,
    selected: period === selected,
  }));
}

/** Where a Silver member's check stands, in a line: showing, or what it waits for. */
export function checkNote(check: SilverCheckPM): { shown: boolean; text: string } {
  const copy = SUBSCRIPTION_COPY.upgrade.plan.silver.check;
  if (check.shown) return { shown: true, text: copy.shown };
  const text =
    check.reason === "held"
      ? copy.held[check.heldFor ?? "admin"]
      : check.reason === "photos"
        ? copy.photos
        : copy.held.admin;
  return { shown: false, text };
}

/** Which story the "current plan" card tells: an open payment comes first. */
export function planState(status: SubscriptionStatusPM): PlanState {
  if (status.open?.status === "submitted") return "review";
  if (status.open) return "pending";
  if (status.rejected) return "rejected";
  return status.plan === "silver" ? "silver" : "basic";
}

/** Upgrade to Silver (Figma 2:179 mobile, 2:2 desktop): the plans, and the way into paying. */
export function useSubscriptionPresenter() {
  const router = useRouter();
  const copy = SUBSCRIPTION_COPY.upgrade;
  const [status, setStatus] = useState<SubscriptionStatusPM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PlanPeriod>("yearly");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let live = true;
    subscriptionService.status().then(
      (s) => {
        if (!live) return;
        setStatus(s);
        if (s.open) setPeriod(s.open.period);
      },
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, []);

  const state: PlanState = status ? planState(status) : "basic";
  const open = status?.open ?? null;
  // The checkout already running for the plan picked: carry on with it rather than start over.
  const resumable = open?.status === "pending" && open.period === period ? open : null;

  const upgrade = useCallback(async () => {
    if (!status) return;
    if (resumable) {
      router.push(Routes.subscriptionPay(resumable.id));
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const payment = await subscriptionService.checkout(period);
      router.push(Routes.subscriptionPay(payment.id));
    } catch (e) {
      setError(messageOf(e));
      setStarting(false);
    }
  }, [period, resumable, router, status]);

  const back = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push(Routes.appHome);
  }, [router]);

  const plan = {
    basic: copy.plan.basic,
    silver: {
      title: copy.plan.silver.title,
      body: status?.forGood
        ? copy.plan.silver.forGood
        : copy.plan.silver.body(status?.silverUntil ? planDate(status.silverUntil) : ""),
    },
    pending: copy.plan.pending,
    review: copy.plan.review,
    rejected: {
      title: copy.plan.rejected.title,
      body: copy.plan.rejected.body(status?.rejected?.reviewNote ?? ""),
    },
  }[state];

  const ctaLabel = starting
    ? copy.cta.starting
    : !status
      ? copy.cta.upgrade
      : status.forGood
        ? copy.cta.forGood
        : state === "review"
          ? copy.cta.review
          : resumable
            ? copy.cta.resume
            : !status.available
              ? copy.cta.unavailable
              : state === "silver"
                ? copy.cta.extend
                : copy.cta.upgrade;

  return {
    loading: status === null && error === null,
    error,
    back,
    planCard: {
      state,
      // Blank until the plan is known, so a Silver member never sees "Basic" first.
      title: status ? plan.title : "",
      body: status ? plan.body : "",
      check: state === "silver" && status?.check ? checkNote(status.check) : null,
      /** An open payment opens; otherwise the card points at the plans below. */
      href: open ? Routes.subscriptionPay(open.id) : "#silver-plans",
    },
    options: status ? planOptions(status.prices, period) : [],
    // Picking the other plan with a checkout open starts that plan's instead.
    selectPeriod: setPeriod,
    showSeeAll: copy.allBenefits.length > copy.features.length,
    cta: {
      label: ctaLabel,
      disabled:
        !status ||
        starting ||
        Boolean(status.forGood) ||
        state === "review" ||
        (!resumable && !status.available),
      onClick: () => void upgrade(),
    },
  };
}
