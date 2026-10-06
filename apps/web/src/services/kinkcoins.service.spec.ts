import { describe, expect, it } from "vitest";
import { kinkcoinsService } from "./kinkcoins.service";

describe("kinkcoinsService", () => {
  it("exposes the three reference currencies and disables actual purchases", () => {
    const vm = kinkcoinsService.preview();
    expect(vm.purchasesEnabled).toBe(false);
    expect(vm.currencies.map((c) => c.name)).toEqual(["KinkCoin", "KinkStar", "KinkCrown"]);
    expect(vm.currencies.every((c) => c.packs.length === 4)).toBe(true);
    expect(vm.copy.notice).toContain("no payments are taken");
  });
  it("labels the zero profile balance as preview, not spendable funds", () => {
    expect(kinkcoinsService.profileBalance()).toMatchObject({
      amount: "0",
      label: "KinkCoins",
      status: "Preview",
    });
    expect(kinkcoinsService.profileBalance().description).toContain("when wallets launch");
  });
});
