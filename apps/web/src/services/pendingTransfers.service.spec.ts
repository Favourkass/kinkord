// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { pendingTransfersService as pending } from "./pendingTransfers.service";

afterEach(() => localStorage.clear());

const withdrawal = {
  currency: "coin" as const,
  quantity: "100",
  bankId: "bank",
  key: "k1",
  expectedAmountKobo: 80000,
};
const gift = { postId: "p1", currency: "star" as const, quantity: "2", key: "k2" };

describe("pendingTransfersService", () => {
  it("keeps an unanswered withdrawal and a gift in doubt per member until settled", () => {
    pending.keepWithdrawal("u1", withdrawal);
    pending.keepGift("u1", gift);
    expect(pending.withdrawal("u1")).toEqual(withdrawal);
    expect(pending.gift("u1")).toEqual(gift);
    expect(pending.withdrawal("u2")).toBeNull();
    pending.settleWithdrawal("u1");
    pending.settleGift("u1");
    expect(pending.withdrawal("u1")).toBeNull();
    expect(pending.gift("u1")).toBeNull();
  });

  it("ignores an entry that isn't a whole request", () => {
    localStorage.setItem(
      "kinkord:unanswered:withdrawal:u1",
      JSON.stringify({ ...withdrawal, key: "" }),
    );
    localStorage.setItem(
      "kinkord:unanswered:gift:u1",
      JSON.stringify({ ...gift, currency: "cash" }),
    );
    expect(pending.withdrawal("u1")).toBeNull();
    expect(pending.gift("u1")).toBeNull();
  });
});
