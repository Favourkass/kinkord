// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKinkCoinsWithdrawPresenter } from "./useKinkCoinsWithdrawPresenter";
import { bankAccountsService } from "@/services/bankAccounts.service";
import { kinkcoinsService } from "@/services/kinkcoins.service";

const stored = vi.hoisted(() => new Map());
vi.mock("@/repositories/bankAccounts.repository", () => ({
  bankAccountsRepository: {
    read: (user: string) => stored.get(user) ?? [],
    write: (user: string, accounts: unknown) => stored.set(user, accounts),
  },
}));
describe("useKinkCoinsWithdrawPresenter", () => {
  beforeEach(() => {
    stored.clear();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  it("uses the member's default preview bank account and allows switching accounts", () => {
    const first = bankAccountsService.add("test", {
      bank: "First Bank",
      holder: "Test User",
      number: "1234567890",
      type: "Savings",
    })[0];
    const accounts = bankAccountsService.add("test", {
      bank: "Second Bank",
      holder: "Test User",
      number: "9876543210",
      type: "Current",
    });
    bankAccountsService.setDefault("test", accounts[1].id);
    const { result } = renderHook(() => useKinkCoinsWithdrawPresenter("test"));
    expect(result.current.bankDetails.name).toBe("Second Bank");
    act(() => result.current.onBankChange(first.id));
    expect(result.current.bankDetails.name).toBe("First Bank");
    expect(result.current.bankDetails.account).toContain("7890");
  });
  it("previews selection, confirmation and processing without changing a wallet or its history", () => {
    const { result } = renderHook(() => useKinkCoinsWithdrawPresenter());
    expect(result.current.step).toBe("options");
    act(() => result.current.onConfirm());
    expect(result.current.step).toBe("options");
    act(() => result.current.onRedeem("coin"));
    expect(result.current.title).toBe("Confirm Redemption");
    expect(result.current.confirmation?.quantity).toBe("1,250");
    act(() => result.current.onConfirm());
    expect(result.current.step).toBe("processing");
    expect(result.current.copy.submittedHint).toContain("No real withdrawal request");
    expect(kinkcoinsService.profileBalance().amount).toBe("0");
    expect(kinkcoinsService.history().copy.total).toBe("0 transactions");
    act(() => result.current.onBack());
    expect(result.current.step).toBe("options");
    expect(result.current.confirmation).toBeNull();
  });
  it("rejects below-minimum redemption and does not retain a previous selection after going back", () => {
    const { result } = renderHook(() => useKinkCoinsWithdrawPresenter());
    act(() => result.current.onRedeem("crown"));
    expect(result.current.step).toBe("options");
    act(() => result.current.onRedeem("coin"));
    act(() => result.current.onBack());
    act(() => result.current.onRedeem("star"));
    expect(result.current.confirmation).toMatchObject({ kind: "star", quantity: "125" });
  });
});
