import { describe, it, expect, vi } from "vitest";
import type { WalletSummaryPM } from "@/domain/wallet";
const post = vi.hoisted(() => vi.fn());
vi.mock("./apiClient", () => ({ api: { post } }));
import { postGiftsService } from "./post-gifts.service";
const summary = {
  settings: { enabled: true },
  balances: [{ currency: "coin", available: 5, reserved: 100 }],
} as WalletSummaryPM;
describe("post gift rules", () => {
  it("allows only whole amounts from available funds, ignoring reserved coins", () => {
    expect(postGiftsService.quote(summary, "coin", "5").valid).toBe(true);
    for (const raw of ["0", "-1", "6", "100", "1.5", "1e2", "", "Infinity"])
      expect(postGiftsService.quote(summary, "coin", raw).valid).toBe(false);
    expect(postGiftsService.quote(summary, "crown", "1").valid).toBe(false);
    expect(postGiftsService.quote(null, "coin", "1").valid).toBe(false);
    expect(
      postGiftsService.quote(
        { ...summary, settings: { ...summary.settings, enabled: false } },
        "coin",
        "1",
      ).valid,
    ).toBe(false);
  });
  it("sends currency units unchanged and leaves recipient identity to the server", async () => {
    await postGiftsService.send("post", "star", 3, "retry-key");
    expect(post).toHaveBeenCalledWith("/wallet/gifts", {
      postId: "post",
      currency: "star",
      quantity: 3,
      requestKey: "retry-key",
    });
  });
});
