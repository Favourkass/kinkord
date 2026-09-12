// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEditPhotosPresenter } from "./useEditPhotosPresenter";

const push = vi.fn();
const router = { push, replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const own = vi.fn();
const upload = vi.fn();
vi.mock("@/services/profile.service", () => ({
  profileApi: { own: () => own() },
  uploadProfileImage: (...a: unknown[]) => upload(...a),
}));

describe("useEditPhotosPresenter", () => {
  beforeEach(() => {
    own.mockReset().mockResolvedValue({ avatarUrl: null, coverUrl: "https://s3/c.jpg" });
    upload.mockReset();
  });

  it("describes both photo cards and uploads a new cover", async () => {
    upload.mockResolvedValueOnce({ avatarUrl: null, coverUrl: "https://s3/new.jpg" });
    const { result } = renderHook(() => useEditPhotosPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.avatar).toMatchObject({
      title: "Profile Photo",
      hint: "JPG, PNG or WebP up to 5MB",
      url: null,
      uploading: false,
    });
    expect(result.current.cover).toMatchObject({
      hint: "JPG, PNG or WebP up to 10MB",
      url: "https://s3/c.jpg",
    });

    const file = new File([new Uint8Array(10)], "cover.jpg", { type: "image/jpeg" });
    act(() => result.current.onCoverFile(file));
    await waitFor(() => expect(result.current.cover.url).toBe("https://s3/new.jpg"));
    expect(upload).toHaveBeenCalledWith("cover", file);
    expect(result.current.notice).toBe("Cover photo updated.");
    act(() => result.current.back());
    expect(push).toHaveBeenCalledWith("/profile/edit");
  });
});
