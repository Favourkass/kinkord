import { describe, expect, it } from "vitest";
import {
  adminPaymentsQuerySchema,
  checkoutSchema,
  paymentSettingsSchema,
  rejectPaymentSchema,
  submitPaymentSchema,
} from "./dto";

const proof = {
  reference: "KIN20260924114238",
  amountKobo: 3_364_700,
  senderBankName: "GTBank",
  senderAccountName: "John Doe",
  senderAccountNumber: "0123456789",
  receiptKey: "payments/u1/p1/r.jpg",
};

describe("checkoutSchema", () => {
  it("takes a monthly or yearly plan", () => {
    expect(checkoutSchema.safeParse({ period: "yearly" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ period: "weekly" }).success).toBe(false);
  });
});

describe("submitPaymentSchema", () => {
  it("takes the member's proof, trimmed", () => {
    const parsed = submitPaymentSchema.parse({ ...proof, senderAccountName: "  John Doe " });
    expect(parsed.senderAccountName).toBe("John Doe");
  });

  it("wants a ten-digit account number", () => {
    const short = submitPaymentSchema.safeParse({ ...proof, senderAccountNumber: "12345" });
    expect(short.success).toBe(false);
    expect(short.error?.issues[0]?.message).toBe("Account numbers are 10 digits.");
    expect(
      submitPaymentSchema.safeParse({ ...proof, senderAccountNumber: "01234-56789" }).success,
    ).toBe(false);
  });

  it("refuses a missing receipt or an amount in fractions of a kobo", () => {
    expect(submitPaymentSchema.safeParse({ ...proof, receiptKey: "" }).success).toBe(false);
    expect(submitPaymentSchema.safeParse({ ...proof, amountKobo: 10.5 }).success).toBe(false);
    expect(submitPaymentSchema.safeParse({ ...proof, amountKobo: 0 }).success).toBe(false);
  });
});

describe("adminPaymentsQuerySchema", () => {
  it("opens on the proofs waiting for a decision", () => {
    expect(adminPaymentsQuerySchema.parse({})).toEqual({ status: "submitted" });
    expect(adminPaymentsQuerySchema.parse({ status: "verified", q: " john " })).toEqual({
      status: "verified",
      q: "john",
    });
    expect(adminPaymentsQuerySchema.safeParse({ status: "all" }).success).toBe(false);
  });
});

describe("rejectPaymentSchema", () => {
  it("needs a reason the member can act on", () => {
    expect(rejectPaymentSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(rejectPaymentSchema.safeParse({ reason: "No transfer for this amount" }).success).toBe(
      true,
    );
  });
});

describe("paymentSettingsSchema", () => {
  it("takes an account and the prices", () => {
    expect(
      paymentSettingsSchema.safeParse({
        bankName: "UBA",
        accountName: "Kinkord Ltd",
        accountNumber: "1028154254",
        monthlyKobo: 560_000,
        yearlyKobo: 3_360_000,
        monthlyUsdCents: 400,
        yearlyUsdCents: 2400,
      }).success,
    ).toBe(true);
  });

  it("refuses an account number that isn't ten digits", () => {
    expect(
      paymentSettingsSchema.safeParse({
        bankName: "UBA",
        accountName: "Kinkord Ltd",
        accountNumber: "102815425",
        monthlyKobo: 560_000,
        yearlyKobo: 3_360_000,
        monthlyUsdCents: 400,
        yearlyUsdCents: 2400,
      }).success,
    ).toBe(false);
  });
});
