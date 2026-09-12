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
const upload = vi.fn();
vi.mock("@/services/profile.service", () => ({
  profileApi: { me: () => me(), own: () => own() },
  uploadProfileImage: (...a: unknown[]) => upload(...a),
}));

const profile = { displayName: "Naughty Neze", avatarUrl: "https://s3/a_md.jpg" };

describe("useEditProfileHubPresenter", () => {
  beforeEach(() => {
    push.mockClear();
    me.mockReset().mockResolvedValue({ username: "nene", displayUsername: "Nene" });
    own.mockReset().mockResolvedValue(profile);
    upload.mockReset();
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

  it("changes the profile photo from the header and reports failures", async () => {
    upload.mockResolvedValueOnce({ ...profile, avatarUrl: "https://s3/new_md.jpg" });
    const { result } = renderHook(() => useEditProfileHubPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const file = new File([new Uint8Array(10)], "me.jpg", { type: "image/jpeg" });
    act(() => result.current.onAvatarFile(file));
    await waitFor(() => expect(result.current.avatarUrl).toBe("https://s3/new_md.jpg"));
    expect(upload).toHaveBeenCalledWith("avatar", file);
    expect(result.current.notice).toBe("Profile photo updated.");

    upload.mockRejectedValueOnce(new Error("Image is too large — max 5MB."));
    act(() => result.current.onAvatarFile(file));
    await waitFor(() => expect(result.current.error).toMatch(/max 5MB/));
  });
});
