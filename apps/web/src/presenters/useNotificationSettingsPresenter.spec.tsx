// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_GROUP_KEYS, type PushPreferencesPM } from "@/domain/pushPreferences";
import { loadPushPreferences, savePushPreference } from "@/services/pushPreferencesService";
import { useNotificationSettingsPresenter } from "./useNotificationSettingsPresenter";

vi.mock("@/services/pushPreferencesService", () => ({
  loadPushPreferences: vi.fn(),
  savePushPreference: vi.fn(),
}));
const allOn = Object.fromEntries(
  PUSH_GROUP_KEYS.map((k) => [k, true]),
) as PushPreferencesPM["settings"];
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadPushPreferences).mockResolvedValue({ settings: allOn });
});

describe("useNotificationSettingsPresenter", () => {
  it("shows a switch for every kind, all on to start, and how bundling works", async () => {
    const { result } = renderHook(() => useNotificationSettingsPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.map((r) => r.key)).toEqual([...PUSH_GROUP_KEYS]);
    expect(result.current.rows.every((r) => r.on)).toBe(true);
    expect(result.current.rhythm).toContain("every two hours");
  });

  it("turns a kind off, then shows what the server saved", async () => {
    vi.mocked(savePushPreference).mockResolvedValue({ settings: { ...allOn, likes: false } });
    const { result } = renderHook(() => useNotificationSettingsPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.rows.find((r) => r.key === "likes")!.onToggle());
    await waitFor(() => expect(result.current.notice).toBe("Saved."));
    expect(savePushPreference).toHaveBeenCalledWith("likes", false);
    expect(result.current.rows.find((r) => r.key === "likes")!.on).toBe(false);
  });

  it("keeps the old setting and says so when saving fails", async () => {
    vi.mocked(savePushPreference).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useNotificationSettingsPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.rows.find((r) => r.key === "messages")!.onToggle());
    await waitFor(() => expect(result.current.error).toContain("Could not save"));
    expect(result.current.rows.find((r) => r.key === "messages")!.on).toBe(true);
  });
});
