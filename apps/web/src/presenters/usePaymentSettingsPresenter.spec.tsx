// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentSettingsPM } from "@/domain/subscription";
import { settingsInput, usePaymentSettingsPresenter } from "./usePaymentSettingsPresenter";

const settings = vi.fn();
const saveSettings = vi.fn();
vi.mock("@/services/subscription.service", () => ({
  paymentsAdminService: {
    settings: () => settings(),
    saveSettings: (...a: unknown[]) => saveSettings(...a),
  },
}));

const current: PaymentSettingsPM = {
  bank: { name: "UBA", accountName: "Kinkord Ltd", accountNumber: "1028154254" },
  prices: {
    monthly: { kobo: 560_000, usdCents: 400 },
    yearly: { kobo: 3_360_000, usdCents: 2400 },
  },
  canEdit: true,
  updatedAt: "2026-10-06T12:00:00Z",
};

const form = {
  bankName: "Access Bank",
  accountName: "Kinkord Ltd",
  accountNumber: "0987654321",
  monthlyNaira: "6,000",
  yearlyNaira: "36,000",
  monthlyUsd: "4",
  yearlyUsd: "24.50",
};

beforeEach(() => {
  settings.mockReset().mockResolvedValue(current);
  saveSettings.mockReset().mockImplementation(async () => ({
    ...current,
    bank: { ...current.bank!, name: "Access Bank" },
  }));
});
afterEach(cleanup);

describe("settingsInput", () => {
  it("turns the form into kobo and cents", () => {
    expect(settingsInput(form)).toEqual({
      bankName: "Access Bank",
      accountName: "Kinkord Ltd",
      accountNumber: "0987654321",
      monthlyKobo: 600_000,
      yearlyKobo: 3_600_000,
      monthlyUsdCents: 400,
      yearlyUsdCents: 2450,
    });
  });

  it("refuses a short account number or a price that isn't one", () => {
    expect(settingsInput({ ...form, accountNumber: "12345" })).toBeNull();
    expect(settingsInput({ ...form, yearlyUsd: "free" })).toBeNull();
    expect(settingsInput({ ...form, bankName: "" })).toBeNull();
  });
});

describe("usePaymentSettingsPresenter", () => {
  it("shows the account and prices once an admin is confirmed", async () => {
    const { result, rerender } = renderHook(({ on }) => usePaymentSettingsPresenter(on), {
      initialProps: { on: false },
    });
    expect(settings).not.toHaveBeenCalled();
    rerender({ on: true });
    await waitFor(() => expect(result.current.bank?.accountNumber).toBe("1028154254"));
    expect(result.current.prices).toEqual({
      monthly: "₦5,600 · $4",
      yearly: "₦33,600 · $24",
    });
    expect(result.current.canEdit).toBe(true);
  });

  it("edits from what's saved, and saves", async () => {
    const { result } = renderHook(() => usePaymentSettingsPresenter(true));
    await waitFor(() => expect(result.current.bank).not.toBeNull());
    act(() => result.current.edit());
    expect(result.current.form).toMatchObject({
      bankName: "UBA",
      monthlyNaira: "5,600",
      yearlyUsd: "24",
    });
    act(() => result.current.setField("bankName", "Access Bank"));
    act(() => result.current.save());
    await waitFor(() => expect(result.current.editing).toBe(false));
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ bankName: "Access Bank" }));
    expect(result.current.notice).toBe("Saved. New payments use this account.");
  });

  it("won't save a form with a mistake in it", async () => {
    const { result } = renderHook(() => usePaymentSettingsPresenter(true));
    await waitFor(() => expect(result.current.bank).not.toBeNull());
    act(() => result.current.edit());
    act(() => result.current.setField("accountNumber", "123"));
    act(() => result.current.save());
    expect(result.current.error).toBe("Check the account number (10 digits) and the prices.");
    expect(saveSettings).not.toHaveBeenCalled();
  });
});
