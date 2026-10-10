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
      rates: null,
      minimumKobo: null,
      enabled: false,
      canEdit: false,
    } as never);
    vi.spyOn(walletAdminService, "queue").mockResolvedValue([]);
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
