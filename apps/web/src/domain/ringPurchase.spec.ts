import { expect, it } from "vitest";
import { ringPurchaseSummary } from "./ringPurchase";
import type { PaymentPM } from "./subscription";
it("describes ring purchase status, actual payment, and expiry without implying buyer Silver", () => {
  const p = {
    purpose: "rings",
    ringQuantity: 2,
    method: "coins",
    coinQuantity: 50,
    usdCents: 500,
    amountKobo: 700000,
    reference: "KR1",
    status: "verified",
    createdAt: "2026-11-02T12:00:00Z",
    reviewedAt: "2026-11-02T12:00:00Z",
  } as PaymentPM;
  expect(ringPurchaseSummary(p)).toMatchObject({
    title: "2 Kink Rings",
    amount: "50 KinkCoins",
    status: "Completed",
    ringExpiry: "31 Jan 2027",
  });
  expect(
    ringPurchaseSummary({ ...p, status: "submitted", method: "bank", reviewedAt: null }),
  ).toMatchObject({ amount: "₦7,000", status: "Pending Verification", ringExpiry: null });
});
