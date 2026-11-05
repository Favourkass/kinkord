"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RING_PURCHASE_COPY } from "@/constants/ringPurchase";
import { Routes } from "@/constants/Routes";
import { ringPurchaseSummary, type RingCheckoutPM, type RingQuotePM } from "@/domain/ringPurchase";
import { naira, usd, type PaymentPM } from "@/domain/subscription";
import { pendingRingPurchase, ringPurchaseService } from "@/services/ringPurchase.service";
import { ApiError } from "@/services/apiClient";
import { giveRingError } from "@/services/kinkRings.service";

export function useRingPurchasePresenter(historyOnly = false) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(2);
  const [quote, setQuote] = useState<RingQuotePM | null>(null);
  const [method, setMethod] = useState<"bank" | "coins">("bank");
  const [step, setStep] = useState<"quantity" | "method">("quantity");
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef<RingCheckoutPM | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [paid, setPaid] = useState<PaymentPM | null>(null);
  const [history, setHistory] = useState<PaymentPM[]>([]);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const loadKey = `${historyOnly}:${quantity}:${page}:${refresh}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;
  useEffect(() => {
    let live = true;
    const load = historyOnly
      ? ringPurchaseService.history(page).then((p) => {
          if (live) {
            setHistory((old) =>
              page === 1
                ? p.items
                : [...old, ...p.items.filter((i) => !old.some((x) => x.id === i.id))],
            );
            setNextPage(p.nextPage);
          }
        })
      : ringPurchaseService.quote(quantity).then((q) => {
          if (live) {
            setQuote(q);
            const pending = pendingRingPurchase.read(q.userId);
            if (pending && !request.current) {
              request.current = pending;
              setUncertain(true);
              setQuantity(pending.quantity);
              setMethod(pending.method);
              setStep("method");
            }
          }
        });
    void load
      .catch((e) => {
        if (live) {
          if (e instanceof ApiError && e.status === 401) router.replace(Routes.login);
          else setError(giveRingError(e, "Could not load purchases. Please try again."));
        }
      })
      .finally(() => {
        if (live) setLoadedKey(loadKey);
      });
    return () => {
      live = false;
    };
  }, [historyOnly, quantity, page, refresh, router, loadKey]);
  const checkout = async () => {
    if (lock.current || (!request.current && (!quote || quote.quantity !== quantity || loading)))
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    request.current ??= {
      senderId: quote!.userId,
      quantity,
      method,
      requestKey: crypto.randomUUID(),
      expectedAmountKobo: quote!.amountKobo,
      expectedCoins: quote!.coins,
    };
    try {
      pendingRingPurchase.save(request.current);
      const payment = await ringPurchaseService.checkout(request.current);
      pendingRingPurchase.clear(request.current.senderId);
      request.current = null;
      setUncertain(false);
      if (payment.method === "coins") setPaid(payment);
      else router.push(Routes.subscriptionPay(payment.id));
    } catch (e) {
      const definitive =
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        ![408, 429].includes(e.status);
      if (definitive) {
        if (request.current) pendingRingPurchase.clear(request.current.senderId);
        request.current = null;
        setUncertain(false);
        setRefresh((n) => n + 1);
      } else setUncertain(true);
      setError(
        giveRingError(
          e,
          "We couldn't confirm the purchase. Retry to safely check the same payment.",
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const current = quote?.quantity === quantity ? quote : null;
  // What 2 rings cost doesn't change with the quantity, so the last quote's price stands.
  const pairUsdCents = quote
    ? (quote.pairUsdCents ?? Math.round((quote.usdCents * 2) / quote.quantity))
    : null;
  return {
    copy: {
      ...RING_PURCHASE_COPY,
      pack: RING_PURCHASE_COPY.pack(pairUsdCents === null ? null : usd(pairUsdCents)),
    },
    historyOnly,
    step,
    quantity,
    method,
    busy,
    loading,
    error,
    uncertain,
    hero: "/kink-rings/gold-heart-ring.webp",
    giftHero: "/kink-rings/gift-box.webp",
    backHref: Routes.kinkRings,
    historyHref: Routes.kinkRingsPurchases,
    topUpHref: Routes.kinkcoinsBuy,
    paid: paid ? ringPurchaseSummary(paid) : null,
    history: history.map((p) => ({
      ...ringPurchaseSummary(p),
      id: p.id,
      href: Routes.subscriptionPay(p.id),
    })),
    more: nextPage !== null,
    onMore: () => {
      if (!loading && nextPage) setPage(nextPage);
    },
    quote: current
      ? {
          amount: naira(current.amountKobo),
          usd: usd(current.usdCents),
          coins: current.coins?.toLocaleString() ?? "Unavailable",
          balance: current.coinBalance.toLocaleString(),
          rings: current.availableRings,
        }
      : null,
    bankAvailable: !!current?.bankAvailable,
    coinsAvailable: current?.coins !== null && !!current,
    insufficient: !!current && current.coins !== null && current.coinBalance < current.coins,
    canPay:
      !loading &&
      !busy &&
      (uncertain ||
        (!!current &&
          (method === "bank"
            ? current.bankAvailable
            : current.coins !== null && current.coinBalance >= current.coins))),
    onQuantity: (n: number) => {
      if (!lock.current && !uncertain && Number.isInteger(n) && n >= 2 && n <= 100 && n % 2 === 0)
        setQuantity(n);
    },
    onMethod: (m: "bank" | "coins") => {
      if (!lock.current && !uncertain) setMethod(m);
    },
    onReview: () => setStep("method"),
    onBack: () => {
      if (!busy && !uncertain) setStep("quantity");
    },
    onRefresh: () => {
      if (!busy) setRefresh((n) => n + 1);
    },
    onPay: checkout,
  };
}
export type RingPurchaseVM = ReturnType<typeof useRingPurchasePresenter>;
