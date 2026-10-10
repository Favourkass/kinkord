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
  it("keeps requests per member until they're settled", () => {
    store.keepWithdrawal("u1", withdrawal);
    store.keepGift("u1", gift);
    expect(store.withdrawal("u1")).toEqual(withdrawal);
    expect(store.gift("u1")).toEqual(gift);
    expect(store.withdrawal("u2")).toBeNull();
    expect(store.gift("u2")).toBeNull();
    store.settleWithdrawal("u1");
    store.settleGift("u1");
    expect(store.withdrawal("u1")).toBeNull();
    expect(store.gift("u1")).toBeNull();
  });

  it("returns nothing for an entry that isn't a whole request, or damaged", () => {
    localStorage.setItem(
      "kinkord:unanswered:withdrawal:u1",
      JSON.stringify({ ...withdrawal, key: "" }),
    );
    localStorage.setItem(
      "kinkord:unanswered:gift:u1",
      JSON.stringify({ ...gift, currency: "cash" }),
    );
    expect(store.withdrawal("u1")).toBeNull();
    expect(store.gift("u1")).toBeNull();
    localStorage.setItem("kinkord:unanswered:gift:u2", "{not json");
    expect(store.gift("u2")).toBeNull();
  });

  it("never throws when storage is off", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("off");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("off");
    });
    expect(store.gift("u1")).toBeNull();
    expect(() => store.keepGift("u1", gift)).not.toThrow();
  });
});
