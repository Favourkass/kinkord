// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PRIVACY_FIELDS } from "@/constants/privacy";
import type { PrivacyPM } from "@/domain/privacy";
const effectiveDefaults = Object.fromEntries(
  PRIVACY_FIELDS.map((f) => [f.key, "members"]),
) as PrivacyPM["settings"];
import { usePrivacyPresenter } from "./usePrivacyPresenter";
import { loadPrivacy, savePrivacy } from "@/services/privacyService";
vi.mock("@/services/privacyService", () => ({ loadPrivacy: vi.fn(), savePrivacy: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadPrivacy).mockResolvedValue({ settings: effectiveDefaults });
});
describe("privacy presenter", () => {
  it("offers exactly one selected audience for each available setting", async () => {
    const { result } = renderHook(() => usePrivacyPresenter("profile"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fields).toHaveLength(15);
    expect(result.current.fields[0].options.filter((x) => x.selected)).toHaveLength(1);
    expect(result.current.fields[0].options.map((x) => x.label)).toContain("Verified members");
  });
  it("shows a saved choice and reloads changes from another device on focus", async () => {
    const { result } = renderHook(() => usePrivacyPresenter("profile"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(savePrivacy).mockResolvedValue({
      settings: { ...effectiveDefaults, bio: "friends" },
    });
    act(() =>
      result.current.fields
        .find((x) => x.key === "bio")!
        .options.find((x) => x.value === "friends")!
        .onSelect(),
    );
    await waitFor(() => expect(result.current.notice).toBe("Privacy setting saved."));
    expect(result.current.fields.find((x) => x.key === "bio")!.audienceLabel).toBe("Friends");
    vi.mocked(loadPrivacy).mockResolvedValue({
      settings: { ...effectiveDefaults, bio: "verified" },
    });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(result.current.fields.find((x) => x.key === "bio")!.audienceLabel).toBe(
        "Verified members",
      ),
    );
  });
  it("keeps the old audience when saving fails", async () => {
    const { result } = renderHook(() => usePrivacyPresenter("activity"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(savePrivacy).mockRejectedValue(new Error("offline"));
    act(() => result.current.fields[0].options[0].onSelect());
    await waitFor(() => expect(result.current.error).toContain("Could not save"));
    expect(result.current.fields[0].audienceLabel).toBe("Kinkordians");
  });
});
