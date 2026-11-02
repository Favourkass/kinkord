import { describe, it, expect } from "vitest";
import { ringPrice, purchasedRings, ringCheckoutSchema } from "./ring-purchases.rules";
describe("ring purchases", () => {
  it("prices $5 pairs using wallet coin and FX rates", () => {
    expect(ringPrice(2, 135000, 10)).toEqual({
      quantity: 2,
      usdCents: 500,
      amountKobo: 675000,
      coins: 50,
    });
    expect(ringPrice(6, 140000, 20)).toEqual({
      quantity: 6,
      usdCents: 1500,
      amountKobo: 2100000,
      coins: 75,
    });
    expect(ringPrice(2, 140000, 3).coins).toBe(167);
    expect(ringPrice(2, 140000, null).coins).toBeNull();
  });
  it.each([0, 1, 3, -2, 101, 2.5, NaN])("refuses invalid quantity %s", (n) =>
    expect(() => ringPrice(n, 140000, 10)).toThrow(),
  );
  it("does not invent missing conversion rates", () => {
    expect(() => ringPrice(2, 0, 10)).toThrow();
    expect(() => ringPrice(2, NaN, 10)).toThrow();
  });
  it("expires all purchased rings exactly 90 days after confirmation", () => {
    const at = new Date("2026-11-02T12:00:00Z");
    const rows = purchasedRings(4, at);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4]);
    expect(rows.every((r) => r.expiresAt.getTime() - at.getTime() === 90 * 86400000)).toBe(true);
  });
  it("requires a quote, idempotency key and owner match; disallows client-supplied balance", () => {
    const input = {
      senderId: "me",
      quantity: 2,
      method: "coins",
      expectedCoins: 50,
      expectedAmountKobo: 700000,
      requestKey: "00000000-0000-4000-8000-000000000001",
    };
    expect(ringCheckoutSchema.safeParse(input).success).toBe(true);
    expect(ringCheckoutSchema.safeParse({ ...input, balance: 500 }).success).toBe(false);
    expect(ringCheckoutSchema.safeParse({ ...input, requestKey: undefined }).success).toBe(false);
  });
});
