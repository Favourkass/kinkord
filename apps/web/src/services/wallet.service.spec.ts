import { beforeEach, describe, it, expect, vi } from "vitest";
import { ngnToKobo, walletService, walletPurchaseUsd } from "./wallet.service";
import type { WalletSettingsPM } from "@/domain/wallet";
const post = vi.hoisted(() => vi.fn());
vi.mock("./apiClient", () => ({ api: { post }, uploadToPresignedUrl: vi.fn() }));
const settings: WalletSettingsPM = {
  currency: "NGN",
  enabled: true,
  rates: {
    coin: { buy: 1000, redeem: 800 },
    star: { buy: 10000, redeem: 8000 },
    crown: { buy: 100000, redeem: 80000 },
  },
  minimumKobo: 80000,
  bank: null,
  packs: { coin: [100], star: [10], crown: [1] },
};
describe("wallet rules at the client boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("parses NGN without floating point drift and refuses fractions of a kobo", () => {
    expect(ngnToKobo("12.34")).toBe(1234);
    for (const bad of ["1.234", "-1", "NaN", "0", "1e4"]) expect(() => ngnToKobo(bad)).toThrow();
  });
  it("uses the configured minimum and never allows reserved or missing funds", () => {
    expect(walletService.minimumQuantity(settings, "coin")).toBe("100");
    expect(walletService.withdrawalQuote(settings, "coin", "100", 100, "bank", true).valid).toBe(
      true,
    );
    for (const [quantity, available, bank] of [
      ["99", 100, "bank"],
      ["101", 100, "bank"],
      ["1.5", 100, "bank"],
      ["100", 100, ""],
    ] as const)
      expect(
        walletService.withdrawalQuote(settings, "coin", quantity, available, bank, true).valid,
      ).toBe(false);
    expect(
      walletService.withdrawalQuote(
        { ...settings, enabled: false },
        "coin",
        "100",
        100,
        "bank",
        true,
      ).valid,
    ).toBe(false);
  });
  it("sends identity-free requests with a retry key and the payout reviewed; the API derives the member", async () => {
    await walletService.withdraw("coin", 100, "bank", "retry", 80000);
    expect(post).toHaveBeenCalledWith("/wallet/withdrawals", {
      currency: "coin",
      quantity: 100,
      bankId: "bank",
      requestKey: "retry",
      expectedAmountKobo: 80000,
    });
  });
});

it("requires withdrawal eligibility even with enough funds and a bank account", () => {
  expect(walletService.withdrawalQuote(settings, "coin", "100", 100, "bank", false).valid).toBe(
    false,
  );
});

describe("dollar catalogue prices", () => {
  const converted = { ...settings, usdConversion: { kobo: 560000, usdCents: 400 } };
  it("uses the configured conversion, calculating bundles before rounding", () => {
    expect(walletPurchaseUsd(1000, converted, true)).toBe("$0.0071");
    expect(walletPurchaseUsd(100000, converted)).toBe("$0.71");
    expect(walletPurchaseUsd(1400000, converted)).toBe("$10.00");
    expect(
      walletPurchaseUsd(1400000, { ...converted, usdConversion: { kobo: 700000, usdCents: 400 } }),
    ).toBe("$8.00");
  });
  it("does not invent an exchange rate when settings are unavailable", () => {
    expect(walletPurchaseUsd(1000, settings)).toBe("—");
    expect(
      walletPurchaseUsd(1000, { ...converted, usdConversion: { kobo: 0, usdCents: 400 } }),
    ).toBe("—");
  });
  it("shows USD in the buy catalogue while keeping the withdrawal quote in NGN", () => {
    const vm = walletService.view("buy", {
      summary: { settings: converted, balances: [] },
      banks: [],
      history: [],
    });
    expect(vm.currencies[0].buyRate).toBe("$0.0071");
    expect(vm.currencies[0].packs[0].price).toBe("$0.71");
    expect(
      walletService.withdrawalQuote(converted, "coin", "100", 100, "bank", true).amount,
    ).toContain("₦");
  });
});
