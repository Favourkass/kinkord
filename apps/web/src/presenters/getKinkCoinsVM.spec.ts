import { describe, expect, it } from "vitest";
import { getKinkCoinsVM, getKinkCoinsOverviewVM, getKinkCoinsHistoryVM } from "./getKinkCoinsVM";

describe("getKinkCoinsVM", () => {
  it("prepares the history page with empty-state copy and navigation", () => {
    const vm = getKinkCoinsHistoryVM();
    expect(vm.copy.title).toBe("Transaction History");
    expect(vm.copy.emptyTitle).toBe("No transactions yet");
    expect(vm.walletHref).toBe("/kinkcoins");
  });
  it("prepares the wallet landing screen and its purchase link", () => {
    const vm = getKinkCoinsOverviewVM();
    expect(vm.copy.heading).toBe("KinkCoins");
    expect(vm.actions[0].href).toBe("/kinkcoins/buy");
    expect(vm.balances).toHaveLength(3);
  });
  it("hands the view display-ready bundle quantities, prices and availability", () => {
    const vm = getKinkCoinsVM();
    expect(vm.copy.title).toBe("KinkCoins & Payment");
    expect(vm.currencies[2].packs[2]).toEqual({ quantity: "5", price: "$50", badge: "POPULAR" });
    expect(vm.balance.status).toBe("Preview");
    expect(vm.purchasesEnabled).toBe(false);
  });
});
