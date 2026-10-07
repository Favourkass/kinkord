// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentPM, SubscriptionStatusPM } from "@/domain/subscription";
import {
  checkNote,
  planOptions,
  planState,
  useSubscriptionPresenter,
} from "./useSubscriptionPresenter";

const router = { push: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const status = vi.fn();
const checkout = vi.fn();
vi.mock("@/services/subscription.service", () => ({
  subscriptionService: {
    status: () => status(),
    checkout: (...a: unknown[]) => checkout(...a),
  },
}));

const prices = {
  monthly: { kobo: 560_000, usdCents: 400 },
  yearly: { kobo: 3_360_000, usdCents: 2400 },
};

const payment = (over: Partial<PaymentPM> = {}): PaymentPM => ({
  id: "p1",
  plan: "silver",
  period: "monthly",
  status: "pending",
  reference: "KIN1",
  amountKobo: 564_700,
  usdCents: 403,
  bank: { name: "UBA", accountName: "Kinkord Ltd", accountNumber: "1028154254" },
  expiresAt: "2026-10-06T13:00:00Z",
  proofUntil: "2026-10-07T13:00:00Z",
  submittedAt: null,
  reviewedAt: null,
  reviewNote: null,
  proof: null,
  createdAt: "2026-10-06T12:00:00Z",
  ...over,
});

const basic: SubscriptionStatusPM = {
  plan: "basic",
  silverUntil: null,
  check: null,
  available: true,
  prices,
  open: null,
  rejected: null,
};

beforeEach(() => {
  router.push.mockReset();
  status.mockReset().mockResolvedValue(basic);
  checkout.mockReset().mockResolvedValue(payment({ id: "p9", period: "yearly" }));
});
afterEach(cleanup);

describe("planOptions", () => {
  it("prices both plans, striking through twelve months beside the year", () => {
    expect(planOptions(prices, "yearly")).toEqual([
      expect.objectContaining({
        period: "monthly",
        price: "$4",
        per: "/ month",
        approx: "≈ ₦5,600",
        strike: null,
        save: null,
        selected: false,
      }),
      expect.objectContaining({
        period: "yearly",
        price: "$24",
        strike: "$48",
        save: "Save 50%",
        selected: true,
      }),
    ]);
  });
});

describe("planState", () => {
  it("puts an open payment before the plan the member has", () => {
    expect(planState(basic)).toBe("basic");
    expect(planState({ ...basic, plan: "silver" })).toBe("silver");
    expect(planState({ ...basic, plan: "silver", open: payment() })).toBe("pending");
    expect(planState({ ...basic, open: payment({ status: "submitted" }) })).toBe("review");
    expect(planState({ ...basic, rejected: payment({ status: "rejected" }) })).toBe("rejected");
  });
});

describe("checkNote", () => {
  const check = { shown: false, reason: null, heldFor: null, showsFrom: null };

  it("says the badge shows, or what it waits for", () => {
    expect(checkNote({ ...check, shown: true })).toEqual({
      shown: true,
      text: "Your Silver badge shows on your profile.",
    });
    expect(checkNote({ ...check, reason: "held", heldFor: "username" })).toEqual({
      shown: false,
      text: "Your badge is hidden while we look at your new username.",
    });
    expect(checkNote({ ...check, reason: "held", heldFor: "admin" }).text).toBe(
      "Your badge is hidden after a review by our team.",
    );
    expect(checkNote({ ...check, reason: "photos" }).text).toBe(
      "Add a profile photo and a cover photo to show your badge.",
    );
    expect(
      checkNote({ ...check, reason: "new_account", showsFrom: "2026-10-20T00:00:00Z" }).text,
    ).toBe("Your badge shows from 20 Oct 2026.");
  });
});

describe("useSubscriptionPresenter", () => {
  it("starts a yearly checkout and goes to pay", async () => {
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(result.current.planCard.title).toBe("You're on Kinkord Basic");
    expect(result.current.cta).toMatchObject({ label: "Upgrade to Silver", disabled: false });
    act(() => result.current.cta.onClick());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/subscription/pay/p9"));
    expect(checkout).toHaveBeenCalledWith("yearly");
  });

  it("checks out the plan picked", async () => {
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    act(() => result.current.selectPeriod("monthly"));
    expect(result.current.options[0].selected).toBe(true);
    act(() => result.current.cta.onClick());
    await waitFor(() => expect(checkout).toHaveBeenCalledWith("monthly"));
  });

  it("carries on with the checkout already running for the plan", async () => {
    status.mockResolvedValue({ ...basic, open: payment() });
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.cta.label).toBe("Continue your payment"));
    expect(result.current.planCard).toMatchObject({
      state: "pending",
      href: "/subscription/pay/p1",
    });
    act(() => result.current.cta.onClick());
    expect(router.push).toHaveBeenCalledWith("/subscription/pay/p1");
    expect(checkout).not.toHaveBeenCalled();
    // Another plan is a new checkout.
    act(() => result.current.selectPeriod("yearly"));
    expect(result.current.cta.label).toBe("Upgrade to Silver");
  });

  it("waits while a payment is being checked", async () => {
    status.mockResolvedValue({ ...basic, open: payment({ status: "submitted" }) });
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.cta.label).toBe("Payment under review"));
    expect(result.current.cta.disabled).toBe(true);
    expect(result.current.planCard.title).toBe("We're checking your payment");
  });

  it("stays closed until there's an account to pay into", async () => {
    status.mockResolvedValue({ ...basic, available: false });
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.cta.label).toBe("Payments open soon"));
    expect(result.current.cta.disabled).toBe(true);
  });

  it("tells a Silver member until when, and offers to extend", async () => {
    status.mockResolvedValue({
      ...basic,
      plan: "silver",
      silverUntil: "2027-10-06T12:00:00Z",
      check: { shown: false, reason: "held", heldFor: "name", showsFrom: null },
    });
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.cta.label).toBe("Extend Silver"));
    expect(result.current.planCard).toMatchObject({
      title: "You're on Silver Premium",
      body: "Active until 6 Oct 2027.",
      check: { shown: false, text: "Your badge is hidden while we look at your new name." },
    });
  });

  it("has nothing to sell to Silver for good, the founders'", async () => {
    status.mockResolvedValue({
      ...basic,
      plan: "silver",
      silverUntil: "2099-12-31T12:00:00Z",
      forGood: true,
    });
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.cta.label).toBe("You're on Silver for good"));
    expect(result.current.cta.disabled).toBe(true);
    expect(result.current.planCard).toMatchObject({
      title: "You're on Silver Premium",
      body: "Yours for good, as part of the Kinkord team.",
    });
  });

  it("shows why the last payment was rejected", async () => {
    status.mockResolvedValue({
      ...basic,
      rejected: payment({ status: "rejected", reviewNote: "No transfer for this amount" }),
    });
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.planCard.state).toBe("rejected"));
    expect(result.current.planCard.body).toBe("No transfer for this amount");
  });

  it("says what went wrong when a checkout can't start", async () => {
    checkout.mockRejectedValue(new Error("We're still checking your last payment."));
    const { result } = renderHook(() => useSubscriptionPresenter());
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    act(() => result.current.cta.onClick());
    await waitFor(() =>
      expect(result.current.error).toBe("We're still checking your last payment."),
    );
    expect(result.current.cta.disabled).toBe(false);
  });
});
