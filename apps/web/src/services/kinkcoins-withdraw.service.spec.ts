import { describe, expect, it } from "vitest";
import { kinkcoinsWithdrawService } from "./kinkcoins-withdraw.service";

describe("kinkcoinsWithdrawService preview", () => {
  it("uses the supplied sample rates and excludes balances below the minimum", () => {
    const vm = kinkcoinsWithdrawService.options();
    expect(vm.currencies.map((currency) => [currency.value, currency.eligible])).toEqual([
      ["$196.00", true],
      ["$144.00", true],
      ["$96.00", false],
    ]);
    expect(vm.copy.previewNotice).toContain("No withdrawal is submitted");
    expect(vm.walletHref).toBe("/kinkcoins");
    expect(vm.homeHref).toBe("/home");
  });
  it("prepares the minimum coin redemption without a fee", () => {
    expect(kinkcoinsWithdrawService.confirmation("coin")).toEqual({
      kind: "coin",
      label: "Coins to Redeem",
      quantity: "1,250",
      amount: "$100.00",
      fee: "$0.00",
    });
  });
  it("uses star rates for the selected currency and rejects the below-minimum crown sample", () => {
    expect(kinkcoinsWithdrawService.confirmation("star")).toMatchObject({
      quantity: "125",
      amount: "$100.00",
      kind: "star",
    });
    expect(kinkcoinsWithdrawService.confirmation("crown")).toBeNull();
  });
});
