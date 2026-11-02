// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useRingPurchasePresenter } from "./useRingPurchasePresenter";
import { ringPurchaseService } from "@/services/ringPurchase.service";
import { ApiError } from "@/services/apiClient";
import type { PaymentPM } from "@/domain/subscription";
const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/ringPurchase.service", async (original) => ({
  ...(await original<typeof import("@/services/ringPurchase.service")>()),
  ringPurchaseService: { quote: vi.fn(), checkout: vi.fn(), history: vi.fn() },
}));
const quote = {
  userId: "buyer",
  quantity: 2,
  usdCents: 500,
  amountKobo: 700000,
  coins: 50,
  coinBalance: 200,
  availableRings: 3,
  bankAvailable: true,
};
const paid = {
  id: "payment",
  purpose: "rings",
  ringQuantity: 2,
  method: "coins",
  coinQuantity: 50,
  status: "verified",
  usdCents: 500,
  amountKobo: 700000,
  reference: "KR1",
  createdAt: "2026-11-02T12:00:00Z",
  reviewedAt: "2026-11-02T12:00:00Z",
} as PaymentPM;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(ringPurchaseService.quote).mockResolvedValue(quote);
  vi.mocked(ringPurchaseService.checkout).mockResolvedValue(paid);
});
async function loaded() {
  const h = renderHook(() => useRingPurchasePresenter());
  await waitFor(() => expect(h.result.current.loading).toBe(false));
  return h;
}
it("charges the configured coin quote, never the 500-coin mockup value", async () => {
  const h = await loaded();
  act(() => h.result.current.onMethod("coins"));
  await act(() => h.result.current.onPay());
  expect(ringPurchaseService.checkout).toHaveBeenCalledWith(
    expect.objectContaining({ senderId: "buyer", expectedCoins: 50, quantity: 2, method: "coins" }),
  );
  expect(h.result.current.paid).toMatchObject({ amount: "50 KinkCoins", status: "Completed" });
  expect(sessionStorage.length).toBe(0);
});
it("restores an uncertain checkout after refresh and reuses its exact key and method", async () => {
  vi.mocked(ringPurchaseService.checkout).mockRejectedValueOnce(new Error("network"));
  const h = await loaded();
  act(() => h.result.current.onMethod("coins"));
  await act(() => h.result.current.onPay());
  expect(h.result.current.uncertain).toBe(true);
  const first = vi.mocked(ringPurchaseService.checkout).mock.calls[0][0];
  h.unmount();
  const fresh = await loaded();
  expect(fresh.result.current.uncertain).toBe(true);
  expect(fresh.result.current.method).toBe("coins");
  act(() => fresh.result.current.onQuantity(4));
  expect(fresh.result.current.quantity).toBe(2);
  await act(() => fresh.result.current.onPay());
  expect(ringPurchaseService.checkout).toHaveBeenLastCalledWith(first);
});
it("disables coin payment for insufficient balance and supports bank payment", async () => {
  vi.mocked(ringPurchaseService.quote).mockResolvedValue({ ...quote, coinBalance: 1 });
  const h = await loaded();
  act(() => h.result.current.onMethod("coins"));
  expect(h.result.current.canPay).toBe(false);
  act(() => h.result.current.onMethod("bank"));
  expect(h.result.current.canPay).toBe(true);
  vi.mocked(ringPurchaseService.checkout).mockResolvedValue({
    ...paid,
    method: "bank",
    status: "pending",
  });
  await act(() => h.result.current.onPay());
  expect(router.push).toHaveBeenCalledWith("/subscription/pay/payment");
});
it("keeps the price-change error and requires a new review after a definitive refusal", async () => {
  vi.mocked(ringPurchaseService.checkout).mockRejectedValueOnce(
    new ApiError(409, { message: "The price has changed." }),
  );
  const h = await loaded();
  await act(() => h.result.current.onPay());
  expect(h.result.current.uncertain).toBe(false);
  expect(sessionStorage.length).toBe(0);
  expect(h.result.current.error).toContain("price has changed");
});
