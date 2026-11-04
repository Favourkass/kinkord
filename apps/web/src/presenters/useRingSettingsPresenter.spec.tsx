// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRingSettingsPresenter } from "./useRingSettingsPresenter";

const settings = vi.fn();
const saveSettings = vi.fn();
vi.mock("@/services/kinkRings.service", () => ({
  kinkRingsAdminApi: {
    settings: (...a: unknown[]) => settings(...a),
    saveSettings: (...a: unknown[]) => saveSettings(...a),
  },
}));
const access = { checking: false, isAdmin: true, isFounder: true };
vi.mock("./useAdminAccessPresenter", () => ({ useAdminAccessPresenter: () => access }));

describe("useRingSettingsPresenter", () => {
  beforeEach(() => {
    settings
      .mockReset()
      .mockResolvedValue({ rings: { monthly: 1, yearly: 12 }, canEdit: true, max: 24 });
    saveSettings.mockReset();
  });

  it("shows how many rings each plan brings", async () => {
    const { result } = renderHook(() => useRingSettingsPresenter());
    await waitFor(() => expect(result.current.card.plans).toHaveLength(2));
    expect(result.current.card.plans.map((p) => [p.label, p.value])).toEqual([
      ["Monthly Silver", "1 ring"],
      ["Yearly Silver", "12 rings"],
    ]);
    expect(result.current.card.canEdit).toBe(true);
    expect(result.current.card.locked).toBeNull();
  });

  it("lets a founder set a year to six rings", async () => {
    saveSettings.mockResolvedValue({ rings: { monthly: 1, yearly: 6 }, canEdit: true, max: 24 });
    const { result } = renderHook(() => useRingSettingsPresenter());
    await waitFor(() => expect(result.current.card.canEdit).toBe(true));
    act(() => result.current.card.onEdit());
    // An API from before the price: no price field, and the counts alone are saved.
    expect(result.current.card.form).toEqual({ monthly: "1", yearly: "12", price: "" });
    expect(result.current.card.showPrice).toBe(false);
    act(() => result.current.card.onField("yearly", "6"));
    await act(async () => result.current.card.onSave());
    expect(saveSettings).toHaveBeenCalledWith({ monthly: 1, yearly: 6 });
    expect(result.current.card.editing).toBe(false);
    expect(result.current.card.plans[1].value).toBe("6 rings");
    expect(result.current.card.notice).toBe("Saved. New checkouts use these.");
  });

  it("asks for whole numbers before saving anything", async () => {
    const { result } = renderHook(() => useRingSettingsPresenter());
    await waitFor(() => expect(result.current.card.canEdit).toBe(true));
    act(() => result.current.card.onEdit());
    act(() => result.current.card.onField("yearly", "30"));
    await act(async () => result.current.card.onSave());
    expect(saveSettings).not.toHaveBeenCalled();
    expect(result.current.card.error).toBe("Enter a whole number from 0 to 24 for each plan.");
  });

  it("shows and changes what 2 bought rings cost", async () => {
    settings.mockResolvedValue({
      rings: { monthly: 1, yearly: 6 },
      pairUsdCents: 500,
      canEdit: true,
      max: 24,
    });
    saveSettings.mockResolvedValue({
      rings: { monthly: 1, yearly: 6 },
      pairUsdCents: 499,
      canEdit: true,
      max: 24,
    });
    const { result } = renderHook(() => useRingSettingsPresenter());
    await waitFor(() => expect(result.current.card.plans).toHaveLength(3));
    expect(result.current.card.plans[2]).toMatchObject({
      label: "2 bought rings cost (USD)",
      value: "$5",
    });
    act(() => result.current.card.onEdit());
    expect(result.current.card.form.price).toBe("5.00");
    act(() => result.current.card.onField("price", "4.99"));
    await act(async () => result.current.card.onSave());
    expect(saveSettings).toHaveBeenCalledWith({ monthly: 1, yearly: 6, pairUsdCents: 499 });
    expect(result.current.card.plans[2].value).toBe("$4.99");
  });

  it("asks for a dollar price before saving anything", async () => {
    settings.mockResolvedValue({
      rings: { monthly: 1, yearly: 6 },
      pairUsdCents: 500,
      canEdit: true,
      max: 24,
    });
    const { result } = renderHook(() => useRingSettingsPresenter());
    await waitFor(() => expect(result.current.card.canEdit).toBe(true));
    act(() => result.current.card.onEdit());
    act(() => result.current.card.onField("price", "4.999"));
    await act(async () => result.current.card.onSave());
    expect(saveSettings).not.toHaveBeenCalled();
    expect(result.current.card.error).toBe(
      "Enter the price of 2 rings in dollars, like 5 or 4.99.",
    );
  });

  it("shows other admins the numbers without the form", async () => {
    settings.mockResolvedValue({ rings: { monthly: 1, yearly: 6 }, canEdit: false, max: 24 });
    const { result } = renderHook(() => useRingSettingsPresenter());
    await waitFor(() =>
      expect(result.current.card.locked).toBe("Only the founders can change this."),
    );
    expect(result.current.card.canEdit).toBe(false);
  });
});
