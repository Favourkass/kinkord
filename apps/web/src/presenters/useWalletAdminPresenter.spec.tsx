// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { useWalletAdminPresenter } from "./useWalletAdminPresenter";
import { walletAdminService } from "@/services/wallet.service";
vi.mock("./useAdminAccessPresenter", () => ({
  useAdminAccessPresenter: () => ({ isAdmin: true }),
}));
vi.mock("@/services/apiClient", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  uploadToPresignedUrl: vi.fn(),
}));
describe("useWalletAdminPresenter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(walletAdminService, "settings").mockResolvedValue({
      usdRates: null,
      minimumKobo: null,
      enabled: false,
      canEdit: false,
    } as never);
    vi.spyOn(walletAdminService, "queue").mockResolvedValue([]);
  });
  it("keeps a failed settings load on screen when the queue loads", async () => {
    vi.mocked(walletAdminService.settings).mockRejectedValueOnce(new Error("Settings are down."));
    const { result } = renderHook(() => useWalletAdminPresenter());
    await waitFor(() => expect(walletAdminService.queue).toHaveBeenCalled());
    await waitFor(() => expect(result.current.error).toBe("Settings are down."));
  });
  it("fills the settings form when a refresh succeeds after a failed first load", async () => {
    const rates = {
      coin: { buy: 10, redeem: 8 },
      star: { buy: 100, redeem: 80 },
      crown: { buy: 1000, redeem: 800 },
    };
    vi.mocked(walletAdminService.settings)
      .mockRejectedValueOnce(new Error("Settings are down."))
      .mockResolvedValue({
        usdRates: rates,
        exchangeRateKobo: 140000,
        minimumKobo: 50000,
        enabled: true,
        canEdit: true,
      } as never);
    const { result } = renderHook(() => useWalletAdminPresenter());
    await waitFor(() => expect(result.current.error).toBe("Settings are down."));
    await act(() => result.current.onRefresh());
    expect(result.current.error).toBeNull();
    expect(result.current.form).toMatchObject({ coinBuy: "0.1", minimum: "500", enabled: true });
  });
  it("refreshes after a save with the filters now in force", async () => {
    vi.mocked(walletAdminService.settings).mockResolvedValue({
      usdRates: {
        coin: { buy: 10, redeem: 8 },
        star: { buy: 100, redeem: 80 },
        crown: { buy: 1000, redeem: 800 },
      },
      exchangeRateKobo: 140000,
      minimumKobo: 50000,
      enabled: true,
      canEdit: true,
    } as never);
    let saved: () => void = () => undefined;
    const save = vi
      .spyOn(walletAdminService, "saveSettings")
      .mockImplementation(() => new Promise((resolve) => (saved = () => resolve({} as never))));
    const { result } = renderHook(() => useWalletAdminPresenter());
    await waitFor(() => expect(result.current.form.coinBuy).toBe("0.1"));
    let saving: Promise<void> = Promise.resolve();
    act(() => {
      saving = result.current.onSave();
    });
    // The save is out before the filter changes.
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        usdRates: {
          coin: { buy: 10, redeem: 8 },
          star: { buy: 100, redeem: 80 },
          crown: { buy: 1000, redeem: 800 },
        },
        exchangeRateKobo: 140000,
      }),
    );
    act(() => result.current.onKind("withdrawal"));
    await act(async () => {
      saved();
      await saving;
    });
    expect(vi.mocked(walletAdminService.queue).mock.calls.at(-1)).toEqual([
      "withdrawal",
      "pending",
    ]);
  });
  it("keeps unsaved settings when the queue filter changes", async () => {
    const { result } = renderHook(() => useWalletAdminPresenter());
    await waitFor(() => expect(walletAdminService.queue).toHaveBeenCalled());
    act(() => result.current.onField("coinBuy", "12"));
    act(() => result.current.onKind("withdrawal"));
    await waitFor(() => expect(walletAdminService.queue).toHaveBeenCalledTimes(2));
    expect(result.current.form.coinBuy).toBe("12");
    expect(walletAdminService.settings).toHaveBeenCalledOnce();
  });
  it("drops a refresh's rows once the filter has changed", async () => {
    const row = (id: string, kind: "purchase" | "withdrawal") =>
      ({
        id,
        userId: "u",
        kind,
        currency: "coin",
        quantity: 1,
        amountKobo: 100,
        status: "pending",
        reference: id,
        bankName: "Test",
        accountName: "Test",
        accountNumber: "1234567890",
        receiptKey: null,
        senderReference: null,
        senderAccountName: null,
        reviewNote: null,
        settlementReference: null,
        createdAt: "2026-10-10T09:00:00.000Z",
        updatedAt: "2026-10-10T09:00:00.000Z",
      }) as never;
    let late: (rows: never[]) => void = () => undefined;
    vi.mocked(walletAdminService.queue)
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise((resolve) => (late = resolve)))
      .mockResolvedValueOnce([row("w1", "withdrawal")]);
    const { result } = renderHook(() => useWalletAdminPresenter());
    await waitFor(() => expect(walletAdminService.queue).toHaveBeenCalledTimes(1));
    let refreshing: Promise<void> = Promise.resolve();
    act(() => {
      refreshing = result.current.onRefresh();
    });
    act(() => result.current.onKind("withdrawal"));
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(["w1"]));
    // The purchases the refresh asked for arrive late: they don't replace the withdrawals.
    await act(async () => {
      late([row("p1", "purchase")]);
      await refreshing;
    });
    expect(result.current.rows.map((r) => r.id)).toEqual(["w1"]);
  });
  it("does not mark a transfer paid just by opening the confirmation", async () => {
    const decide = vi.spyOn(walletAdminService, "decide").mockResolvedValue({} as never);
    const { result } = renderHook(() => useWalletAdminPresenter());
    await waitFor(() => expect(walletAdminService.queue).toHaveBeenCalled());
    act(() => result.current.onAsk("op", "paid"));
    expect(decide).not.toHaveBeenCalled();
    act(() => result.current.onDetail("BANK-REF"));
    await act(() => result.current.onDecide());
    expect(decide).toHaveBeenCalledWith("op", { action: "paid", bankReference: "BANK-REF" });
    expect(result.current.dialog).toBeNull();
    expect(result.current.canEdit).toBe(false);
  });
});
