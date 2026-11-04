// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { pendingRingPurchase, ringPurchaseService } from "./ringPurchase.service";
import { api } from "./apiClient";
import type { RingCheckoutPM } from "@/domain/ringPurchase";
vi.mock("./apiClient", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const request: RingCheckoutPM = {
  senderId: "buyer",
  quantity: 2,
  method: "coins",
  requestKey: "11111111-1111-4111-8111-111111111111",
  expectedAmountKobo: 675000,
  expectedCoins: 50,
};
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});
it("preserves the exact uncertain request, scoped to its member", () => {
  pendingRingPurchase.save(request);
  expect(pendingRingPurchase.read("buyer")).toEqual(request);
  expect(pendingRingPurchase.read("another-member")).toBeNull();
  pendingRingPurchase.clear("buyer");
  expect(pendingRingPurchase.read("buyer")).toBeNull();
});
it("discards malformed stored requests rather than sending a corrupted price", () => {
  sessionStorage.setItem(
    "kinkord:ring-purchase:buyer",
    JSON.stringify({ ...request, expectedCoins: -5 }),
  );
  expect(pendingRingPurchase.read("buyer")).toBeNull();
  sessionStorage.setItem("kinkord:ring-purchase:buyer", "broken");
  expect(pendingRingPurchase.read("buyer")).toBeNull();
});
it("uses the server quote, checkout and paginated purchase endpoints", async () => {
  await ringPurchaseService.quote(4);
  await ringPurchaseService.checkout(request);
  await ringPurchaseService.history(2);
  expect(api.get).toHaveBeenCalledWith("/kink-rings/purchase-quote?quantity=4");
  expect(api.post).toHaveBeenCalledWith("/kink-rings/checkout", request);
  expect(api.get).toHaveBeenCalledWith("/kink-rings/purchases?page=2");
});
