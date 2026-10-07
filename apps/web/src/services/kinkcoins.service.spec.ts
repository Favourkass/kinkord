import { describe, expect, it } from "vitest";
import { kinkcoinsService } from "./kinkcoins.service";

describe("kinkcoinsService", () => {
  it("routes buying and history to their pages and leaves future transactions unavailable", () => {
    const vm = kinkcoinsService.overview();
    expect(vm.actions[0]).toMatchObject({ kind: "buy", href: "/kinkcoins/buy", status: null });
    expect(vm.actions[2]).toMatchObject({
      kind: "history",
      href: "/kinkcoins/history",
      status: null,
    });
    const unavailable = vm.actions.filter((action) => action.href === null);
    expect(unavailable).toHaveLength(3);
    expect(
      unavailable.every((action) => action.href === null && action.status === "Coming soon"),
    ).toBe(true);
    expect(vm.balances.map((balance) => balance.kind)).toEqual(["coin", "star", "crown"]);
    expect(vm.balances.every((balance) => balance.amount === "0")).toBe(true);
    expect(vm.copy.preview).toContain("Preview");
  });
  it("shows an empty preview history without inventing transactions", () => {
    const vm = kinkcoinsService.history();
    expect(vm.copy.total).toBe("0 transactions");
    expect(vm.copy.notice).toContain("No purchases, gifts or rewards have been recorded");
    expect(vm.walletHref).toBe("/kinkcoins");
    expect(vm.buyHref).toBe("/kinkcoins/buy");
  });
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
