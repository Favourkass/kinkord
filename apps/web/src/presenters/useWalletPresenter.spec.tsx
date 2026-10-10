// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { useWalletPresenter } from "./useWalletPresenter";
import { ApiError } from "@/services/apiClient";
import { pendingTransfersService } from "@/services/pendingTransfers.service";
import { walletService, type WalletDataPM } from "@/services/wallet.service";
const router = vi.hoisted(() => ({ push: vi.fn() }));
// Each test's hook unmounts after it, so its polling and focus listener stop with it.
afterEach(cleanup);
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/apiClient")>()),
  api: { get: vi.fn(), post: vi.fn() },
  uploadToPresignedUrl: vi.fn(),
}));
const data: WalletDataPM = {
  summary: {
    userId: "u",
    redemption: { canRedeem: true, reason: null },
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
    balances: [{ currency: "coin", available: 200, reserved: 0, withdrawable: 150 }],
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
    localStorage.clear();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    router.push.mockReset();
    vi.spyOn(walletService, "load").mockResolvedValue(data);
  });
  it("loads server balances and requires an explicit withdrawal review", async () => {
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currencies[0].available).toBe(200);
    expect(result.current.currencies[0].withdrawable).toBe(150);
    expect(result.current.bankId).toBe("bank");
    expect(result.current.review).toBe(false);
    act(() => result.current.onRedeem("coin"));
    expect(result.current.quantity).toBe("100");
    expect(result.current.quote.valid).toBe(true);
  });
  it("sends an unanswered withdrawal again exactly as it was, whatever the form says now", async () => {
    const second = { ...data.banks[0], id: "bank2", isDefault: 0 };
    const banks = [...data.banks, second];
    const load = vi.spyOn(walletService, "load").mockResolvedValue({ ...data, banks });
    const withdraw = vi
      .spyOn(walletService, "withdraw")
      // How the API client reports a dropped connection.
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }))
      .mockResolvedValue({
        id: "w1",
        userId: "u",
        kind: "withdrawal",
        currency: "coin",
        quantity: 100,
        amountKobo: 80000,
        status: "pending",
        reference: "KRD-20261010-ABCD1234",
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
      });
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    expect(result.current.error).toBe("connection lost");
    // It went through after all (the balance dropped), and the form now names another account.
    load.mockResolvedValue({
      ...data,
      banks,
      summary: {
        ...data.summary,
        balances: [{ currency: "coin", available: 100, reserved: 100, withdrawable: 50 }],
      },
    });
    await act(() => result.current.onRefresh());
    act(() => result.current.onBank("bank2"));
    expect(result.current.quote.valid).toBe(false);
    expect(result.current.canSubmitWithdrawal).toBe(true);
    expect(result.current.unansweredNotice).toBeTruthy();
    await act(() => result.current.onWithdraw());
    // Same currency, quantity, account, key and reviewed payout (100 × ₦8.00): the server
    // answers with the one it made.
    expect(withdraw.mock.calls[0][4]).toBe(80000);
    expect(withdraw).toHaveBeenCalledTimes(2);
    expect(withdraw.mock.calls[1]).toEqual(withdraw.mock.calls[0]);
    expect(result.current.unansweredNotice).toBeNull();
  });
  it("keeps the refusal on screen when the refresh after it fails", async () => {
    vi.spyOn(walletService, "load")
      .mockResolvedValueOnce(data)
      .mockRejectedValue(new Error("offline"));
    vi.spyOn(walletService, "withdraw").mockRejectedValueOnce(
      new ApiError(409, { message: "The withdrawal rate has changed." }),
    );
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(result.current.error).toBe("The withdrawal rate has changed.");
  });
  it("keeps proof it has sent, though a read that started earlier lands after", async () => {
    const pending = {
      id: "op1",
      userId: "u",
      kind: "purchase" as const,
      currency: "coin" as const,
      quantity: 100,
      amountKobo: 100000,
      status: "pending" as const,
      reference: "KKC20261010100000",
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
    };
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    let late: (op: typeof pending) => void = () => undefined;
    vi.spyOn(walletService, "operation")
      .mockResolvedValueOnce(pending)
      .mockImplementationOnce(() => new Promise((resolve) => (late = resolve)))
      .mockResolvedValue({ ...pending, status: "submitted" as never });
    vi.spyOn(walletService, "submitProof").mockResolvedValue({
      ...pending,
      status: "submitted" as never,
    });
    const { result } = renderHook(() => useWalletPresenter("pay", "op1"));
    await waitFor(() => expect(result.current.operation?.status).toBe("pending"));
    // A background read starts (the window regains focus), and is slow.
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    act(() => {
      result.current.onFile(new File(["x"], "receipt.png", { type: "image/png" }));
      result.current.onProofField("senderAccountName", "Ada Okafor");
      result.current.onProofField("senderReference", "REF123");
    });
    await act(() => result.current.onSubmitProof());
    expect(result.current.operation?.status).toBe("submitted");
    // The slow read lands with the payment as it was before.
    await act(async () => {
      late(pending);
    });
    expect(result.current.operation?.status).toBe("submitted");
  });
  it("shows the request a retry will send, with its fields locked", async () => {
    const second = { ...data.banks[0], id: "bank2", isDefault: 0 };
    vi.spyOn(walletService, "load").mockResolvedValue({ ...data, banks: [...data.banks, second] });
    vi.spyOn(walletService, "withdraw").mockRejectedValueOnce(
      new ApiError(0, { message: "connection lost" }),
    );
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    act(() => {
      result.current.onQuantity("150");
      result.current.onBank("bank2");
    });
    expect(result.current.fieldsLocked).toBe(true);
    expect(result.current.quantity).toBe("100");
    expect(result.current.bankId).toBe("bank");
    expect(result.current.quote.amountKobo).toBe(80000);
  });
  it("loads at once under Strict Mode's second setup", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    const { result } = renderHook(() => useWalletPresenter("withdraw"), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.currencies[0].available).toBe(200));
    expect(result.current.loading).toBe(false);
  });
  it("still loads when reads are slower than the polling", async () => {
    const answers: Array<(value: WalletDataPM) => void> = [];
    const load = vi
      .spyOn(walletService, "load")
      .mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    // A poll (the window regains focus) while the first read is still out: skipped.
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(load).toHaveBeenCalledOnce();
    await act(async () => {
      answers[0](data);
    });
    expect(result.current.currencies[0].available).toBe(200);
  });
  it("brings back a withdrawal left unanswered before a reload, review open, same key", async () => {
    const kept = {
      currency: "coin" as const,
      quantity: "100",
      bankId: "bank",
      key: "kept-key",
      expectedAmountKobo: 80000,
    };
    pendingTransfersService.keepWithdrawal("u", kept);
    vi.spyOn(walletService, "load").mockResolvedValue({
      ...data,
      summary: { ...data.summary, userId: "u" },
    });
    const withdraw = vi.spyOn(walletService, "withdraw").mockResolvedValue({
      id: "w1",
      userId: "u",
      kind: "withdrawal",
      currency: "coin",
      quantity: 100,
      amountKobo: 80000,
      status: "pending",
      reference: "KRD-1",
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
    });
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.unansweredNotice).toBeTruthy());
    expect(result.current.review).toBe(true);
    expect(result.current.canCancel).toBe(false);
    act(() => result.current.onCancel());
    expect(result.current.review).toBe(true);
    await act(() => result.current.onWithdraw());
    expect(withdraw).toHaveBeenCalledWith("coin", 100, "bank", "kept-key", 80000, "u");
    expect(pendingTransfersService.withdrawals("u")).toEqual([]);
  });
  it("brings back a kept withdrawal when Retry loads the wallet after a failed first load", async () => {
    pendingTransfersService.keepWithdrawal("u", {
      currency: "coin",
      quantity: "100",
      bankId: "bank",
      key: "kept-key",
      expectedAmountKobo: 80000,
    });
    vi.spyOn(walletService, "load")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(data);
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.error).toBe("offline"));
    await act(() => result.current.onRefresh());
    expect(result.current.unansweredNotice).toBeTruthy();
    expect(result.current.review).toBe(true);
  });
  it("shows what really happened to a recovered withdrawal, paid included", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    vi.spyOn(walletService, "withdraw")
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }))
      .mockResolvedValueOnce({
        id: "w1",
        userId: "u",
        kind: "withdrawal",
        currency: "coin",
        quantity: 100,
        amountKobo: 80000,
        status: "paid",
        reference: "KRD-1",
        bankName: "Test",
        accountName: "Test",
        accountNumber: "1234567890",
        receiptKey: null,
        senderReference: null,
        senderAccountName: null,
        reviewNote: null,
        settlementReference: "BANK-REF",
        createdAt: "2026-10-10T09:00:00.000Z",
        updatedAt: "2026-10-10T09:00:00.000Z",
      });
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    await act(() => result.current.onWithdraw());
    expect(result.current.operationTitle).toBe("Paid");
    expect(result.current.operationNote).toBe("The admin has recorded your bank transfer as paid.");
  });
  it("takes the kept copy over its own memory: another tab's newer one, or settled elsewhere", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    const withdraw = vi
      .spyOn(walletService, "withdraw")
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }));
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    // Another tab settled that one and kept a newer withdrawal, still unanswered.
    localStorage.clear();
    pendingTransfersService.keepWithdrawal("u", {
      currency: "coin",
      quantity: "120",
      bankId: "bank",
      key: "newer",
      expectedAmountKobo: 96000,
    });
    await act(() => result.current.onWithdraw());
    expect(withdraw).toHaveBeenCalledOnce();
    expect(result.current.quantity).toBe("120");
    withdraw.mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }));
    await act(() => result.current.onWithdraw());
    expect(withdraw.mock.calls[1][3]).toBe("newer");
    // Then it's answered in that other tab: nothing is sent from here.
    localStorage.clear();
    await act(() => result.current.onWithdraw());
    expect(withdraw).toHaveBeenCalledTimes(2);
    expect(result.current.error).toMatch(/another tab/);
    expect(result.current.unansweredNotice).toBeNull();
  });
  it("sends under the member's cross-tab lock, and a new request after another tab's answer gets a new key", async () => {
    const request = vi.fn((_name: string, work: () => Promise<unknown>) => work());
    Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    const withdraw = vi
      .spyOn(walletService, "withdraw")
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }));
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    expect(request).toHaveBeenCalledWith("kinkord:wallet:u", expect.any(Function));
    // Answered in another tab: nothing is sent from here...
    localStorage.clear();
    await act(() => result.current.onWithdraw());
    expect(result.current.error).toMatch(/another tab/);
    // ...and the next withdrawal is a new one, with a new key.
    withdraw.mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    expect(withdraw).toHaveBeenCalledTimes(2);
    expect(withdraw.mock.calls[1][3]).not.toBe(withdraw.mock.calls[0][3]);
    Reflect.deleteProperty(navigator, "locks");
  });
  it("starts over when another account is signed in, keeping the last one's request for it", async () => {
    const load = vi.spyOn(walletService, "load").mockResolvedValue(data);
    vi.spyOn(walletService, "withdraw").mockRejectedValueOnce(
      new ApiError(0, { message: "connection lost" }),
    );
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    // Another tab signs in as someone else.
    load.mockResolvedValue({
      ...data,
      summary: { ...data.summary, userId: "someone-else" },
      banks: [{ ...data.banks[0], id: "their-bank", userId: "someone-else" }],
    });
    await act(() => result.current.onRefresh());
    expect(result.current.review).toBe(false);
    expect(result.current.unansweredNotice).toBeNull();
    expect(result.current.notice).toMatch(/someone else/);
    expect(result.current.bankId).toBe("their-bank");
    expect(pendingTransfersService.withdrawals("u")).toHaveLength(1);
  });
  it("closes the review when a refresh finds it answered in another tab", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    vi.spyOn(walletService, "withdraw").mockRejectedValueOnce(
      new ApiError(0, { message: "connection lost" }),
    );
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    expect(result.current.unansweredNotice).toBeTruthy();
    localStorage.clear();
    await act(() => result.current.onRefresh());
    expect(result.current.review).toBe(false);
    expect(result.current.unansweredNotice).toBeNull();
    expect(result.current.notice).toMatch(/another tab/);
  });
  it("keeps its own unanswered withdrawal when storage can't be read", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    const withdraw = vi
      .spyOn(walletService, "withdraw")
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }))
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }));
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    const blocked = vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new Error("blocked");
    });
    await act(() => result.current.onWithdraw());
    // Sent again with its own key, not taken for answered elsewhere.
    expect(withdraw).toHaveBeenCalledTimes(2);
    expect(withdraw.mock.calls[1][3]).toBe(withdraw.mock.calls[0][3]);
    blocked.mockRestore();
  });
  it("won't start a withdrawal over another tab's one still unanswered", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    const withdraw = vi.spyOn(walletService, "withdraw");
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    // Another tab sent one that got no answer, after this page loaded.
    pendingTransfersService.keepWithdrawal("u", {
      currency: "coin",
      quantity: "100",
      bankId: "bank",
      key: "other-tab",
      expectedAmountKobo: 80000,
    });
    await act(() => result.current.onWithdraw());
    expect(withdraw).not.toHaveBeenCalled();
    expect(result.current.unansweredNotice).toBeTruthy();
  });
  it("never brings back another member's unanswered withdrawal", async () => {
    pendingTransfersService.keepWithdrawal("someone-else", {
      currency: "coin",
      quantity: "100",
      bankId: "bank",
      key: "theirs",
      expectedAmountKobo: 80000,
    });
    vi.spyOn(walletService, "load").mockResolvedValue({
      ...data,
      summary: { ...data.summary, userId: "u" },
    });
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unansweredNotice).toBeNull();
  });
  it("keeps the account shown when the default changes elsewhere", async () => {
    const second = { ...data.banks[0], id: "bank2", isDefault: 0 };
    const load = vi
      .spyOn(walletService, "load")
      .mockResolvedValue({ ...data, banks: [...data.banks, second] });
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    expect(result.current.bankId).toBe("bank");
    // Another tab makes the second account the default.
    load.mockResolvedValue({
      ...data,
      banks: [
        { ...data.banks[0], isDefault: 0 },
        { ...second, isDefault: 1 },
      ],
    });
    await act(() => result.current.onRefresh());
    expect(result.current.bankId).toBe("bank");
  });
  it("keeps an unanswered withdrawal when the retry finds them signed out", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    vi.spyOn(walletService, "withdraw")
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }))
      .mockRejectedValueOnce(new ApiError(401, { message: "Sign in again." }));
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    await act(() => result.current.onWithdraw());
    expect(result.current.unansweredNotice).toBeTruthy();
    expect(result.current.canSubmitWithdrawal).toBe(true);
  });
  it("keeps an unanswered withdrawal when the API finds another account signed in", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    const withdraw = vi
      .spyOn(walletService, "withdraw")
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }))
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: "WRONG_ACCOUNT",
          message: "You're signed in as someone else now.",
        }),
      );
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    // Another tab signed in as someone else: the API refuses the retry before reading it.
    await act(() => result.current.onWithdraw());
    expect(withdraw.mock.calls[1][5]).toBe("u");
    expect(result.current.error).toMatch(/someone else/);
    expect(result.current.unansweredNotice).toBeTruthy();
    expect(pendingTransfersService.withdrawals("u")).toHaveLength(1);
  });
  it("keeps an unanswered withdrawal when the retry meets a sign-up step", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    vi.spyOn(walletService, "withdraw")
      .mockRejectedValueOnce(new ApiError(0, { message: "connection lost" }))
      .mockRejectedValueOnce(
        new ApiError(403, { code: "PROFILE_PHOTOS_REQUIRED", message: "Add your photos" }),
      );
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    await act(() => result.current.onWithdraw());
    expect(result.current.unansweredNotice).toBeTruthy();
  });
  it("settles a first send that was turned away unread", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    vi.spyOn(walletService, "withdraw").mockRejectedValueOnce(
      new ApiError(401, { message: "Sign in again." }),
    );
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    expect(result.current.error).toBe("Sign in again.");
    expect(result.current.unansweredNotice).toBeNull();
  });
  it("takes a refusal as an answer: the form decides what's sent next", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue(data);
    vi.spyOn(walletService, "withdraw").mockRejectedValueOnce(
      new ApiError(409, { message: "Insufficient" }),
    );
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    await act(() => result.current.onWithdraw());
    expect(result.current.error).toBe("Insufficient");
    expect(result.current.unansweredNotice).toBeNull();
  });
  it("falls back to the default account when the picked one is removed elsewhere", async () => {
    const second = { ...data.banks[0], id: "bank2", isDefault: 0 };
    const load = vi
      .spyOn(walletService, "load")
      .mockResolvedValue({ ...data, banks: [...data.banks, second] });
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onBank("bank2"));
    expect(result.current.bankId).toBe("bank2");
    // Removed in another tab: the next refresh no longer has it.
    load.mockResolvedValue(data);
    await act(() => result.current.onRefresh());
    expect(result.current.bankId).toBe("bank");
    expect(result.current.selectedBank?.id).toBe("bank");
  });
  it("won't withdraw bought coins: only what was received as gifts", async () => {
    vi.spyOn(walletService, "load").mockResolvedValue({
      ...data,
      summary: {
        ...data.summary,
        balances: [{ currency: "coin", available: 200, reserved: 0, withdrawable: 50 }],
      },
    });
    const { result } = renderHook(() => useWalletPresenter("withdraw"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onRedeem("coin"));
    expect(result.current.quantity).toBe("100");
    expect(result.current.quote.valid).toBe(false);
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
  expect(result.current.selectedBankOption?.badge).toEqual({ text: "ODS", colour: "#3F3F46" });
  act(() => result.current.onBankField("bankName", "unknown bank"));
  await act(() => result.current.onSaveBank());
  expect(add).toHaveBeenCalled();
  expect(result.current.error).toContain("Choose a bank");
});

it("blocks redemption when the Silver badge is missing", async () => {
  vi.spyOn(walletService, "load").mockResolvedValue({
    ...data,
    summary: {
      ...data.summary,
      redemption: { canRedeem: false, reason: "Silver badge required" },
    },
  });
  const withdraw = vi.spyOn(walletService, "withdraw");
  const { result } = renderHook(() => useWalletPresenter("withdraw"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.onRedeem("coin"));
  expect(result.current.quote.valid).toBe(false);
  await act(() => result.current.onWithdraw());
  expect(withdraw).not.toHaveBeenCalled();
});
