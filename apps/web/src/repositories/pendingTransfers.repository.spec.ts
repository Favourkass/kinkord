// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { pendingTransfersRepository as store } from "./pendingTransfers.repository";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const withdrawal = {
  currency: "coin" as const,
  quantity: "100",
  bankId: "bank",
  key: "k1",
  expectedAmountKobo: 80000,
};
const gift = { postId: "p1", currency: "star" as const, quantity: "2", key: "k2" };

describe("pendingTransfersRepository", () => {
  it("keeps requests per member until each is settled", () => {
    expect(store.keepWithdrawal("u1", withdrawal)).toBe(true);
    expect(store.keepGift("u1", gift)).toBe(true);
    expect(store.withdrawals("u1")).toEqual([withdrawal]);
    expect(store.gifts("u1")).toEqual([gift]);
    expect(store.withdrawals("u2")).toEqual([]);
    store.settleWithdrawal("u1", "k1");
    store.settleGift("u1", "k2");
    expect(store.withdrawals("u1")).toEqual([]);
    expect(store.gifts("u1")).toEqual([]);
  });

  it("keeps each tab's request apart: settling one leaves the others", () => {
    store.keepGift("u1", gift);
    store.keepGift("u1", { ...gift, key: "other-tab" });
    expect(store.gifts("u1").map((g) => g.key)).toEqual(["k2", "other-tab"]);
    store.settleGift("u1", "k2");
    expect(store.gifts("u1").map((g) => g.key)).toEqual(["other-tab"]);
  });

  it("skips an entry that isn't a whole request, or damaged", () => {
    localStorage.setItem(
      "kinkord:unanswered:withdrawal:u1:k1",
      JSON.stringify({ ...withdrawal, key: "" }),
    );
    localStorage.setItem("kinkord:unanswered:gift:u1:k2", JSON.stringify({ ...gift, currency: "cash" }));
    localStorage.setItem("kinkord:unanswered:gift:u1:k3", "{not json");
    expect(store.withdrawals("u1")).toEqual([]);
    expect(store.gifts("u1")).toEqual([]);
  });

  it("says when it couldn't keep a request (storage off or full), and never throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(store.keepGift("u1", gift)).toBe(false);
    expect(store.gifts("u1")).toEqual([]);
  });
});
