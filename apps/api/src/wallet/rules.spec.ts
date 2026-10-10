import { describe, it, expect } from "vitest";
import { paymentReference } from "../subscriptions/plans";
import { nextWalletStatus, sameSender, walletAmount, walletPaymentReference } from "./rules";
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

describe("wallet payment reference", () => {
  it("never shares Silver's reference for a checkout in the same second", () => {
    const at = new Date("2026-10-09T13:56:01Z");
    const silver = paymentReference(at);
    const wallet = walletPaymentReference(at, new Set([silver]));
    expect(silver).toBe("KIN20261009145601");
    expect(wallet).toBe("KKC20261009145601");
    expect(wallet).not.toBe(silver);
  });

  it("matches KKC + year month day hour minute second in Lagos time", () => {
    expect(walletPaymentReference(new Date("2026-10-07T12:47:20Z"), new Set())).toBe(
      "KKC20261007134720",
    );
  });
  it("uses the next free second when another payment has the same code", () => {
    expect(
      walletPaymentReference(
        new Date("2026-10-07T12:47:20Z"),
        new Set(["KKC20261007134720", "KKC20261007134721"]),
      ),
    ).toBe("KKC20261007134722");
  });
  it("handles date and year rollover without changing the reference format", () => {
    expect(
      walletPaymentReference(new Date("2026-12-31T22:59:59Z"), new Set(["KKC20261231235959"])),
    ).toBe("KKC20270101000000");
  });
});

describe("sameSender", () => {
  it("passes the member signed in, and refuses another as WRONG_ACCOUNT", () => {
    expect(() => sameSender("u1", "u1")).not.toThrow();
    expect(() => sameSender("u1", undefined)).not.toThrow();
    try {
      sameSender("u1", "u2");
      throw new Error("not refused");
    } catch (e) {
      expect((e as { getResponse(): unknown }).getResponse()).toMatchObject({
        code: "WRONG_ACCOUNT",
      });
    }
  });
});
