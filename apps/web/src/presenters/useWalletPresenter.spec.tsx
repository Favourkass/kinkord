// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { useWalletPresenter } from "./useWalletPresenter";
import { walletService, type WalletDataPM } from "@/services/wallet.service";
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/apiClient", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  uploadToPresignedUrl: vi.fn(),
}));
const data: WalletDataPM = {
  summary: {
    settings: {
      currency: "NGN",
      enabled: true,
      rates: {
        coin: { buy: 1000, redeem: 800 },
        star: { buy: 10000, redeem: 8000 },
        crown: { buy: 100000, redeem: 80000 },
      },
      minimumKobo: 80000,
      bank: null,
      packs: { coin: [100], star: [], crown: [] },
    },
    balances: [{ currency: "coin", available: 200, reserved: 0 }],
  },
  banks: [
    {
      id: "bank",
      userId: "u",
      bankName: "Test",
      accountName: "Member",
      accountNumber: "1234567890",
      isDefault: 1,
      createdAt: "2026-10-07",
    },
  ],
  history: [],
};
describe("useWalletPresenter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    router.push.mockReset();
    vi.spyOn(walletService, "load").mockResolvedValue(data);
  });
  it("loads server balances and requires an explicit withdrawal review", async () => {
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currencies[0].available).toBe(200);
    expect(result.current.bankId).toBe("bank");
    expect(result.current.review).toBe(false);
    act(() => result.current.onRedeem("coin"));
    expect(result.current.quantity).toBe("100");
    expect(result.current.quote.valid).toBe(true);
  });
  it("keeps the same request key when a purchase response fails, then permits a new purchase after success", async () => {
    const buy = vi
      .spyOn(walletService, "buy")
      .mockRejectedValueOnce(new Error("connection lost"))
      .mockResolvedValue({ id: "payment" } as never);
    const { result } = renderHook(() => useWalletPresenter("buy"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.onBuy("coin", 100));
    expect(result.current.error).toBe("connection lost");
    await act(() => result.current.onBuy("coin", 100));
    expect(buy.mock.calls[0][2]).toBe(buy.mock.calls[1][2]);
    expect(router.push).toHaveBeenCalledWith("/kinkcoins/pay/payment");
    await act(() => result.current.onBuy("coin", 100));
    expect(buy.mock.calls[2][2]).not.toBe(buy.mock.calls[1][2]);
  });
});

it("selects a bank from search and refuses a name outside the directory", async () => {
  vi.spyOn(walletService, "load").mockResolvedValue(data);
  const add = vi.spyOn(walletService, "addBank");
  const { result } = renderHook(() => useWalletPresenter("banks"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.onOpenBankPicker());
  act(() => result.current.onBankSearch("opay"));
  expect(result.current.bankOptions[0].name).toContain("OPay");
  act(() => result.current.onChooseBank(result.current.bankOptions[0].name));
  expect(result.current.bankPickerOpen).toBe(false);
  expect(result.current.selectedBankOption?.logo).toBeTruthy();
  act(() => result.current.onBankField("bankName", "unknown bank"));
  await act(() => result.current.onSaveBank());
  expect(add).toHaveBeenCalled();
  expect(result.current.error).toContain("Choose a bank");
});
