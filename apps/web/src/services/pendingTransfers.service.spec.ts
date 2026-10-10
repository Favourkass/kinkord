// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "./apiClient";
import { pendingTransfersService as pending } from "./pendingTransfers.service";

afterEach(() => localStorage.clear());

describe("pendingTransfersService", () => {
  it("keeps an unanswered withdrawal and a gift in doubt per member until settled", () => {
    const withdrawal = {
      currency: "coin" as const,
      quantity: "100",
      bankId: "bank",
      key: "k1",
      expectedAmountKobo: 80000,
    };
    const gift = { postId: "p1", currency: "star" as const, quantity: "2", key: "k2" };
    pending.keepWithdrawal("u1", withdrawal);
    pending.keepGift("u1", gift);
    expect(pending.withdrawal("u1")).toEqual(withdrawal);
    expect(pending.gift("u1")).toEqual(gift);
    pending.settleWithdrawal("u1", "k1");
    pending.settleGift("u1", "k2");
    expect(pending.withdrawal("u1")).toBeNull();
    expect(pending.gift("u1")).toBeNull();
  });
});

describe("what a failed money request says", () => {
  it("is refused when the wallet read it and said no", () => {
    expect(pending.failure(new ApiError(409, { message: "Insufficient" }))).toBe("refused");
    expect(pending.failure(new ApiError(404, { message: "Gone" }))).toBe("refused");
    expect(pending.failure(new ApiError(403, { message: "Silver only" }))).toBe("refused");
  });
  it("is unread when it was turned away before the wallet saw it", () => {
    for (const status of [401, 408, 429])
      expect(pending.failure(new ApiError(status, { message: "x" }))).toBe("unread");
    expect(
      pending.failure(
        new ApiError(403, { code: "PROFILE_PHOTOS_REQUIRED", message: "Add your photos" }),
      ),
    ).toBe("unread");
    // Sent as one member while another is signed in (a switch in another tab).
    expect(
      pending.failure(new ApiError(409, { code: "WRONG_ACCOUNT", message: "Someone else" })),
    ).toBe("unread");
  });
  it("is unknown without an answer", () => {
    expect(pending.failure(new ApiError(0, { message: "offline" }))).toBe("unknown");
    expect(pending.failure(new ApiError(502, { message: "bad gateway" }))).toBe("unknown");
    expect(pending.failure(new Error("boom"))).toBe("unknown");
  });
});
