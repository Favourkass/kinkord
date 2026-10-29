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
vi.mock("@/services/privacyService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/privacyService")>()),
  loadPrivacy: vi.fn(),
  savePrivacy: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadPrivacy).mockResolvedValue({ settings: effectiveDefaults });
});
describe("privacy presenter", () => {
  it("offers exactly one selected audience for each available setting", async () => {
    const { result } = renderHook(() => usePrivacyPresenter("profile"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fields).toHaveLength(14);
    expect(result.current.fields[0].options.filter((x) => x.selected)).toHaveLength(1);
    const labels = result.current.fields[0].options.map((x) => x.label);
    expect(labels).toContain("Kinkordians");
    expect(labels).toContain("Only me");
    // Nobody can verify while identity verification is off.
    expect(labels).not.toContain("Verified members");
  });
  it("explains that only online status, read receipts and messaging work both ways", async () => {
    const { result } = renderHook(() => usePrivacyPresenter("profile"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.description).not.toContain("both ways");
    const hint = (key: string) => result.current.fields.find((x) => x.key === key)?.hint;
    expect(hint("onlineStatus")).toContain("both ways");
    expect(hint("bio")).toContain("body type");
    expect(hint("media")).toContain("each post's own audience");
    expect(hint("posts")).toBeNull();
    const activity = renderHook(() => usePrivacyPresenter("activity")).result;
    await waitFor(() => expect(activity.current.loading).toBe(false));
    expect(activity.current.description).toContain("both ways");
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
  it("doesn't list pinned posts, and keeps stories unavailable", async () => {
    const { result } = renderHook(() => usePrivacyPresenter("profile"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // A pinned post follows its own audience, and there are no stories yet.
    expect(result.current.fields.map((f) => f.key)).not.toContain("pinnedPosts");
    expect(result.current.fields.find((f) => f.key === "stories")?.unavailable).toBe(true);
  });
  it("offers and saves one messaging audience in its own category", async () => {
    const { result } = renderHook(() => usePrivacyPresenter("messaging"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fields.map((field) => field.key)).toEqual(["messaging"]);
    expect(result.current.description).toContain("both ways");
    vi.mocked(savePrivacy).mockResolvedValue({
      settings: { ...effectiveDefaults, messaging: "onlyMe" },
    });
    act(() => result.current.fields[0].options.find((item) => item.value === "onlyMe")!.onSelect());
    await waitFor(() => expect(result.current.fields[0].audienceLabel).toBe("Only me"));
    expect(savePrivacy).toHaveBeenCalledWith("messaging", "onlyMe");
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
