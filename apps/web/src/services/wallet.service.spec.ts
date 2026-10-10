import { beforeEach, describe, it, expect, vi } from "vitest";
import { ngnToKobo, walletService, walletPurchaseUsd } from "./wallet.service";
import type { WalletSettingsPM } from "@/domain/wallet";
const post = vi.hoisted(() => vi.fn());
vi.mock("./apiClient", () => ({ api: { post }, uploadToPresignedUrl: vi.fn() }));
const settings: WalletSettingsPM = {
  currency: "NGN",
  usdConversion: { kobo: 560000, usdCents: 400 },
  enabled: true,
  rates: {
    coin: { buy: 1000, redeem: 800 },
    star: { buy: 10000, redeem: 8000 },
    crown: { buy: 100000, redeem: 80000 },
  },
  minimumKobo: 10_000_000,
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
    expect(walletService.minimumQuantity(settings, "coin")).toBe("12500");
    expect(
      walletService.withdrawalQuote(settings, "coin", "12500", 12500, "bank", true).valid,
    ).toBe(true);
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
  it("sends a retry key, the payout reviewed and who it's sent as; the API checks the member", async () => {
    await walletService.withdraw("coin", 100, "bank", "retry", 80000, "u");
    expect(post).toHaveBeenCalledWith("/wallet/withdrawals", {
      currency: "coin",
      quantity: 100,
      bankId: "bank",
      requestKey: "retry",
      expectedAmountKobo: 80000,
      senderId: "u",
    });
  });
});

it("requires withdrawal eligibility even with enough funds and a bank account", () => {
  expect(walletService.withdrawalQuote(settings, "coin", "100", 100, "bank", false).valid).toBe(
    false,
  );
});

it("requires 12,500 coins, 1,250 stars or 125 crowns for a ₦100,000 withdrawal", () => {
  for (const [kind, count] of [
    ["coin", 12500],
    ["star", 1250],
    ["crown", 125],
  ] as const) {
    expect(walletService.minimumQuantity(settings, kind)).toBe(String(count));
    expect(
      walletService.withdrawalQuote(settings, kind, String(count), count, "bank", true).valid,
    ).toBe(true);
    expect(
      walletService.withdrawalQuote(settings, kind, String(count - 1), count, "bank", true).valid,
    ).toBe(false);
  }
});
describe("dollar catalogue and naira custom purchase budgets", () => {
  it("shows dollar catalogue prices using the shared payment conversion", () => {
    const vm = walletService.view("buy", {
      summary: { settings, balances: [] },
      banks: [],
      history: [],
    });
    expect(vm.currencies[0].buyRate).toBe("$0.0071");
    expect(vm.currencies[0].packs[0].price).toBe("$0.71");
    expect(walletPurchaseUsd(100000, null)).toBe("—");
  });
  it("converts budgets to whole units without exceeding the entered budget", () => {
    expect(walletService.quantityForBudget(settings, "coin", "1234")).toBe("123");
    expect(walletService.quantityForBudget(settings, "star", "1234")).toBe("12");
    expect(walletService.quantityForBudget(settings, "crown", "1234")).toBe("1");
    expect(walletService.quantityForBudget(settings, "coin", "-1")).toBe("");
    expect(walletService.purchaseQuote(settings, "coin", "123")).toMatchObject({
      valid: true,
      amountNgn: "1230",
    });
    expect(walletService.purchaseQuote(settings, "coin", "99").valid).toBe(false);
    expect(walletService.purchaseQuote(settings, "coin", "100.5").valid).toBe(false);
  });
});

it("keeps the specified USD standard with independent ₦1,400 wallet conversion", () => {
  const dollarSettings = {
    ...settings,
    usdConversion: { kobo: 140000, usdCents: 100 },
    rates: {
      coin: { buy: 14000, redeem: 11200 },
      star: { buy: 140000, redeem: 112000 },
      crown: { buy: 1400000, redeem: 1120000 },
    },
  };
  const vm = walletService.view("buy", {
    summary: { settings: dollarSettings, balances: [] },
    banks: [],
    history: [],
  });
  expect(vm.currencies.map((c) => c.buyRate)).toEqual(["$0.10", "$1.00", "$10.00"]);
  expect(walletService.purchaseQuote(dollarSettings, "coin", "100")).toMatchObject({
    amount: "$10.00",
    amountNgn: "14000",
    valid: true,
  });
  expect(walletService.minimumQuantity(dollarSettings, "coin")).toBe("893");
  expect(walletService.minimumQuantity(dollarSettings, "star")).toBe("90");
  expect(walletService.minimumQuantity(dollarSettings, "crown")).toBe("9");
});
