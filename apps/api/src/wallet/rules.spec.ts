import { describe, it, expect } from "vitest";
import { nextWalletStatus, walletAmount } from "./rules";
const rates = {
  coin: { buy: 1000, redeem: 800 },
  star: { buy: 10000, redeem: 8000 },
  crown: { buy: 100000, redeem: 80000 },
};
describe("wallet monetary rules", () => {
  it("calculates NGN in integer kobo and enforces bundles and redemption minimums", () => {
    expect(walletAmount(rates, "coin", 100, "purchase", 80000)).toBe(100000);
    expect(walletAmount(rates, "star", 10, "withdrawal", 80000)).toBe(80000);
    expect(() => walletAmount(rates, "coin", 99, "purchase", 80000)).toThrow(/bundle/);
    expect(() => walletAmount(rates, "coin", 99, "withdrawal", 80000)).toThrow(/minimum/);
    expect(() => walletAmount(rates, "coin", 1.5, "withdrawal", 1)).toThrow(/whole/);
    expect(() => walletAmount(rates, "crown", 1000000, "withdrawal", 1)).toThrow(/limit/);
  });
  it("requires proof before credit and approval before recording a manual payout", () => {
    expect(nextWalletStatus("purchase", "submitted", "verify")).toBe("verified");
    expect(nextWalletStatus("withdrawal", "pending", "approve")).toBe("approved");
    expect(nextWalletStatus("withdrawal", "approved", "paid")).toBe("paid");
    expect(nextWalletStatus("withdrawal", "approved", "reject")).toBe("rejected");
    for (const [kind, status, action] of [
      ["purchase", "pending", "verify"],
      ["purchase", "verified", "verify"],
      ["withdrawal", "pending", "paid"],
      ["withdrawal", "paid", "paid"],
      ["withdrawal", "rejected", "reject"],
      ["purchase", "submitted", "approve"],
    ] as const)
      expect(() => nextWalletStatus(kind, status, action)).toThrow();
  });
});
