import { describe, it, expect } from "vitest";
import {
  walletBankSchema,
  walletDecisionSchema,
  walletGiftSchema,
  walletSettingsSchema,
  withdrawalSchema,
} from "./dto";
describe("wallet request validation", () => {
  it("requires ten-digit bank accounts and a saved bank/idempotency key for withdrawals", () => {
    expect(
      walletBankSchema.safeParse({
        bankName: "Test Bank",
        accountName: "Test User",
        accountNumber: "1234567890",
      }).success,
    ).toBe(true);
    expect(
      walletBankSchema.safeParse({
        bankName: "Test Bank",
        accountName: "Test User",
        accountNumber: "12345",
      }).success,
    ).toBe(false);
    expect(withdrawalSchema.safeParse({ currency: "coin", quantity: 100 }).success).toBe(false);
  });
  it("requires real transfer references for payment verification and payouts, and a rejection reason", () => {
    expect(walletDecisionSchema.safeParse({ action: "verify" }).success).toBe(false);
    expect(walletDecisionSchema.safeParse({ action: "paid" }).success).toBe(false);
    expect(walletDecisionSchema.safeParse({ action: "reject", note: "" }).success).toBe(false);
    expect(
      walletDecisionSchema.parse({ action: "paid", bankReference: " bank123 " }).bankReference,
    ).toBe("BANK123");
  });
  it("rejects negative rates, fractional kobo and redemption above purchase price", () => {
    const input = {
      rates: {
        coin: { buy: 1000, redeem: 800 },
        star: { buy: 10000, redeem: 8000 },
        crown: { buy: 100000, redeem: 80000 },
      },
      minimumKobo: 80000,
      enabled: true,
    };
    expect(walletSettingsSchema.safeParse(input).success).toBe(true);
    expect(
      walletSettingsSchema.safeParse({
        ...input,
        rates: { ...input.rates, coin: { buy: 100, redeem: 101 } },
      }).success,
    ).toBe(false);
    expect(walletSettingsSchema.safeParse({ ...input, minimumKobo: 10.5 }).success).toBe(false);
  });
});

it("does not record a transfer reference while merely approving a withdrawal", () => {
  expect(
    walletDecisionSchema.safeParse({ action: "approve", bankReference: "NOT-PAID" }).success,
  ).toBe(false);
});

describe("withdrawal requests", () => {
  const request = {
    currency: "coin",
    quantity: 100,
    requestKey: "22222222-2222-4222-8222-222222222222",
    bankId: "33333333-3333-4333-8333-333333333333",
  };
  it("carry the payout the member reviewed", () => {
    expect(withdrawalSchema.safeParse(request).success).toBe(false);
    expect(withdrawalSchema.safeParse({ ...request, expectedAmountKobo: 80000 }).success).toBe(
      true,
    );
  });
});

describe("wallet ids", () => {
  it("are lowercased, as Postgres returns them, so a retry compares like for like", () => {
    const parsed = withdrawalSchema.parse({
      currency: "coin",
      quantity: 100,
      requestKey: "AAAAAAAA-2222-4222-8222-222222222222",
      bankId: "BBBBBBBB-3333-4333-8333-333333333333",
      expectedAmountKobo: 80000,
    });
    expect(parsed.requestKey).toBe("aaaaaaaa-2222-4222-8222-222222222222");
    expect(parsed.bankId).toBe("bbbbbbbb-3333-4333-8333-333333333333");
    expect(
      walletGiftSchema.parse({
        currency: "coin",
        quantity: 1,
        requestKey: "22222222-2222-4222-8222-222222222222",
        postId: "CCCCCCCC-1111-4111-8111-111111111111",
      }).postId,
    ).toBe("cccccccc-1111-4111-8111-111111111111");
  });
});
