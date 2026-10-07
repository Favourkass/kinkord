import { beforeEach, describe, it, expect, vi } from "vitest";
import { ngnToKobo, walletService } from "./wallet.service";
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
    expect(walletService.withdrawalQuote(settings, "coin", "100", 100, "bank").valid).toBe(true);
    for (const [quantity, available, bank] of [
      ["99", 100, "bank"],
      ["101", 100, "bank"],
      ["1.5", 100, "bank"],
      ["100", 100, ""],
    ] as const)
      expect(walletService.withdrawalQuote(settings, "coin", quantity, available, bank).valid).toBe(
        false,
      );
    expect(
      walletService.withdrawalQuote({ ...settings, enabled: false }, "coin", "100", 100, "bank")
        .valid,
    ).toBe(false);
  });
  it("sends identity-free requests with a retry key; the API derives the member", async () => {
    await walletService.withdraw("coin", 100, "bank", "retry");
    expect(post).toHaveBeenCalledWith("/wallet/withdrawals", {
      currency: "coin",
      quantity: 100,
      bankId: "bank",
      requestKey: "retry",
    });
  });
});
