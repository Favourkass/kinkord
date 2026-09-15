// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEditProfileHubPresenter } from "./useEditProfileHubPresenter";

const replace = vi.fn();
const push = vi.fn();
// Stable object, like Next's real router — a fresh one per render would re-run fetch effects.
const router = { push, replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const me = vi.fn();
const own = vi.fn();
vi.mock("@/services/profile.service", () => ({
  profileApi: { me: () => me(), own: () => own() },
}));

const profile = { displayName: "Naughty Neze", avatarUrl: "https://s3/a_md.jpg" };

describe("useEditProfileHubPresenter", () => {
  beforeEach(() => {
    push.mockClear();
    me.mockReset().mockResolvedValue({ username: "nene", displayUsername: "Nene" });
    own.mockReset().mockResolvedValue(profile);
  });

  it("shows the identity header and links the five sections in order", async () => {
    const { result } = renderHook(() => useEditProfileHubPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.name).toBe("Naughty Neze");
    expect(result.current.handle).toBe("· @Nene");
    expect(result.current.avatarUrl).toBe("https://s3/a_md.jpg");
    expect(result.current.tierLabel).toBe("Basic Member");
    expect(result.current.rows.map((r) => r.href)).toEqual([
      "/profile/edit/photos",
      "/profile/edit/basic",
      "/profile/edit/kinks",
      "/profile/edit/location",
      "/profile/edit/privacy",
    ]);
    expect(result.current.rows[1].title).toBe("Basic Information");
    act(() => result.current.back());
    expect(push).toHaveBeenCalledWith("/profile");
  });

  it("routes header photo changes through the confirmed Photos & Media screen", async () => {
    const { result } = renderHook(() => useEditProfileHubPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.changePhoto());
    expect(push).toHaveBeenCalledWith("/profile/edit/photos");
  });
});
