import { describe, expect, it } from "vitest";
import { currencyToVM } from "./kinkcoins";

describe("currencyToVM", () => {
  it("formats reference prices in cents without turning them into wallet credits", () => {
    const vm = currencyToVM({
      kind: "coin",
      name: "KinkCoin",
      plural: "KinkCoins",
      description: "Coins",
      unitPriceCents: 10,
      packs: [
        { quantity: 1000, priceCents: 10000, badge: "POPULAR" },
        { quantity: 100, priceCents: 1000 },
      ],
    });
    expect(vm.unitPrice).toBe("$0.10 each");
    expect(vm.packs).toEqual([
      { quantity: "1,000", price: "$100", badge: "POPULAR" },
      { quantity: "100", price: "$10", badge: null },
    ]);
  });
});
