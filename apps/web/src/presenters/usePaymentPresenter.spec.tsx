// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentPM } from "@/domain/subscription";
import { paymentNotice, paymentView, usePaymentPresenter } from "./usePaymentPresenter";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const getPayment = vi.fn();
const status = vi.fn();
const checkout = vi.fn();
vi.mock("@/services/subscription.service", () => ({
  subscriptionService: {
    payment: (...a: unknown[]) => getPayment(...a),
    status: () => status(),
    checkout: (...a: unknown[]) => checkout(...a),
  },
}));

const NOW = new Date("2026-10-06T12:30:00Z");
const prices = {
  monthly: { kobo: 560_000, usdCents: 400 },
  yearly: { kobo: 3_360_000, usdCents: 2400 },
};

const payment = (over: Partial<PaymentPM> = {}): PaymentPM => ({
  id: "p1",
  plan: "silver",
  period: "yearly",
  status: "pending",
  reference: "KIN20261006123000",
  amountKobo: 3_364_700,
  usdCents: 2403,
  bank: { name: "UBA", accountName: "Kinkord Ltd", accountNumber: "1028154254" },
  expiresAt: "2026-10-06T13:30:00Z",
  proofUntil: "2026-10-07T13:30:00Z",
  submittedAt: null,
  reviewedAt: null,
  reviewNote: null,
  proof: null,
  createdAt: "2026-10-06T12:30:00Z",
  ...over,
});

const writeText = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  router.push.mockReset();
  router.replace.mockReset();
  getPayment.mockReset().mockResolvedValue(payment());
  status.mockReset().mockResolvedValue({ prices });
  checkout.mockReset().mockResolvedValue(payment({ id: "p2", period: "monthly" }));
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("paymentView", () => {
  it("follows the payment from the countdown to a decision", () => {
    expect(paymentView(payment(), NOW)).toBe("pay");
    expect(paymentView(payment(), new Date("2026-10-06T14:00:00Z"))).toBe("expired");
    expect(paymentView(payment(), new Date("2026-10-08T00:00:00Z"))).toBe("lapsed");
    expect(paymentView(payment({ status: "submitted" }), NOW)).toBe("submitted");
    expect(paymentView(payment({ status: "verified" }), NOW)).toBe("verified");
    expect(paymentView(payment({ status: "rejected" }), NOW)).toBe("rejected");
  });
});

describe("paymentNotice", () => {
  it("says nothing while the member can still act, and why when rejected", () => {
    expect(paymentNotice("pay", null)).toBeNull();
    expect(paymentNotice("expired", null)).toBeNull();
    expect(paymentNotice("rejected", "Wrong amount")).toMatchObject({
      tone: "problem",
      body: "Wrong amount",
    });
    expect(paymentNotice("verified", null)?.tone).toBe("success");
  });
});

describe("usePaymentPresenter", () => {
  it("shows the amount, the account and the clock", async () => {
    const { result } = renderHook(() => usePaymentPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("pay"));
    expect(result.current.amount).toMatchObject({ value: "₦33,647", usd: "(≈ $24.03)" });
    expect(result.current.bank).toMatchObject({
      badge: { text: "UBA" },
      accountName: "Kinkord Ltd",
      accountNumber: "1028154254",
    });
    expect(result.current.countdown).toBe("01:00:00");
    expect(result.current.plans.map((p) => [p.period, p.selected, p.save])).toEqual([
      ["monthly", false, null],
      ["yearly", true, "SAVE 50%"],
    ]);
  });

  it("copies the plain numbers a bank app wants, and says so for a moment", async () => {
    const { result } = renderHook(() => usePaymentPresenter("p1"));
    await waitFor(() => expect(result.current.amount).not.toBeNull());
    await act(async () => result.current.amount?.onCopy());
    expect(writeText).toHaveBeenCalledWith("33647");
    expect(result.current.amount?.copyLabel).toBe("Copied");
    await act(async () => result.current.bank?.copyAccountNumber.onCopy());
    expect(writeText).toHaveBeenLastCalledWith("1028154254");
    expect(result.current.amount?.copyLabel).toBe("Copy");
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.bank?.copyAccountNumber.label).toBe("Copy");
  });

  it("goes on to the proof only once the transfer is confirmed", async () => {
    const { result } = renderHook(() => usePaymentPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("pay"));
    expect(result.current.canContinue).toBe(false);
    act(() => result.current.toggleConfirmed());
    expect(result.current.canContinue).toBe(true);
    act(() => result.current.proceed());
    expect(router.push).toHaveBeenCalledWith("/subscription/proof/p1");
  });

  it("moves to a new payment when the member picks the other plan", async () => {
    const { result } = renderHook(() => usePaymentPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("pay"));
    act(() => result.current.selectPlan("monthly"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/subscription/pay/p2"));
    expect(checkout).toHaveBeenCalledWith("monthly");
  });

  it("offers to start again or send proof once time is up", async () => {
    getPayment.mockResolvedValue(payment({ expiresAt: "2026-10-06T12:00:00Z" }));
    checkout.mockResolvedValue(payment({ id: "p3" }));
    const { result } = renderHook(() => usePaymentPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("expired"));
    expect(result.current.countdown).toBe("00:00:00");
    act(() => result.current.restart());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/subscription/pay/p3"));
    expect(checkout).toHaveBeenCalledWith("yearly");
  });

  it("says where a payment stands once it's out of the member's hands", async () => {
    getPayment.mockResolvedValue(payment({ status: "submitted" }));
    const { result } = renderHook(() => usePaymentPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("submitted"));
    expect(result.current.notice?.title).toBe("Payment sent for verification");
    // Plans can't be switched now.
    act(() => result.current.selectPlan("monthly"));
    expect(checkout).not.toHaveBeenCalled();
  });

  it("reports a payment that can't be loaded", async () => {
    getPayment.mockRejectedValue(new Error("Payment not found."));
    const { result } = renderHook(() => usePaymentPresenter("nope"));
    await waitFor(() => expect(result.current.error).toBe("Payment not found."));
    expect(result.current.loading).toBe(false);
  });
});
