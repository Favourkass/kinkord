// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useProfilePresenter, useSecurityPresenter } from "./useProfilePresenter";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
const uploadToPresignedUrl = vi.fn<(url: string, file: File) => Promise<void>>(async () => {});
vi.mock("@/services/apiClient", () => {
  class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`HTTP ${status}`);
    }
  }
  return {
    ApiError,
    api: {
      get: (...a: unknown[]) => get(...a),
      patch: (...a: unknown[]) => {
        return patch(...a);
      },
      post: (...a: unknown[]) => {
        return post(...a);
      },
    },
    uploadToPresignedUrl: (url: string, file: File) => uploadToPresignedUrl(url, file),
  };
});

// Canvas is unavailable in jsdom, so stand in for the resizer and hand back a set of files.
const buildUploadSet = vi.fn();
vi.mock("@/util/image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/util/image")>()),
  buildUploadSet: (...a: unknown[]) => buildUploadSet(...a),
}));

const twoFactorEnable = vi.fn();
const verifyTotp = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: {
    signOut: vi.fn(),
    changePassword: vi.fn(async () => ({ error: null })),
    twoFactor: {
      enable: (...a: unknown[]) => twoFactorEnable(...a),
      verifyTotp: (...a: unknown[]) => verifyTotp(...a),
      disable: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,QR") },
}));

const me = {
  id: "u1",
  email: "a@b.c",
  emailVerified: true,
  username: "tega",
  displayUsername: "Tega",
  twoFactorEnabled: false,
};
const profileVM = {
  displayName: "Sir T",
  bio: null,
  pronouns: null,
  country: "NG",
  state: "Delta",
  city: "Sapele",
  dateOfBirth: "1999-08-04",
  gender: "male",
  roles: ["Dominant"],
  phone: null,
  phoneVerified: false,
  avatarUrl: null,
  coverUrl: null,
};

describe("useProfilePresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    get.mockReset().mockImplementation(async (path: string) => (path === "/me" ? me : profileVM));
    patch.mockReset().mockResolvedValue(profileVM);
  });

  it("loads /me and /profile and seeds the edit buffer", async () => {
    const { result } = renderHook(() => useProfilePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.me?.username).toBe("tega");
    expect(result.current.edit.displayName).toBe("Sir T");
  });

  it("saves the edit buffer through PATCH /profile", async () => {
    const { result } = renderHook(() => useProfilePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setEdit({ ...result.current.edit, bio: "hello" }));
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(result.current.notice).toMatch(/saved/i));
    expect(patch).toHaveBeenCalledWith("/profile", expect.objectContaining({ bio: "hello" }));
  });

  describe("uploadImage", () => {
    const raw = new File([new Uint8Array(4_000_000)], "IMG_0042.HEIC.jpg", { type: "image/jpeg" });
    const original = new File([new Uint8Array(180_000)], "IMG_0042.jpg", { type: "image/jpeg" });
    const sm = new File([new Uint8Array(8_000)], "IMG_0042_sm.jpg", { type: "image/jpeg" });
    const md = new File([new Uint8Array(40_000)], "IMG_0042_md.jpg", { type: "image/jpeg" });

    beforeEach(() => {
      buildUploadSet.mockReset().mockResolvedValue({ original, variants: { sm, md } });
      uploadToPresignedUrl.mockClear();
      post.mockReset().mockResolvedValue({
        key: "avatars/u1/abc.jpg",
        uploadUrl: "https://s3/put",
        variantUploadUrls: { sm: "https://s3/put_sm", md: "https://s3/put_md" },
        maxSizeMb: 5,
      });
    });

    it("uploads every stored size, then points the profile at the key", async () => {
      const { result } = renderHook(() => useProfilePresenter());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        void result.current.uploadImage("avatar", raw);
      });
      await waitFor(() => expect(result.current.uploading).toBeNull());

      expect(buildUploadSet).toHaveBeenCalledWith(raw, "avatar");
      // The declared size is the original's, which is what the API signs.
      expect(post).toHaveBeenCalledWith("/profile/upload-url", {
        kind: "avatar",
        contentType: "image/jpeg",
        contentLength: original.size,
      });
      expect(uploadToPresignedUrl.mock.calls).toEqual([
        ["https://s3/put_sm", sm],
        ["https://s3/put_md", md],
        ["https://s3/put", original],
      ]);
      expect(patch).toHaveBeenCalledWith("/profile", { avatarKey: "avatars/u1/abc.jpg" });
      expect(result.current.error).toBeNull();
    });

    it("builds the set for covers too", async () => {
      const { result } = renderHook(() => useProfilePresenter());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        void result.current.uploadImage("cover", raw);
      });
      await waitFor(() => expect(patch).toHaveBeenCalled());
      expect(buildUploadSet).toHaveBeenCalledWith(raw, "cover");
      expect(patch).toHaveBeenCalledWith("/profile", { coverKey: "avatars/u1/abc.jpg" });
    });

    it("leaves the old photo in place when a size fails to upload", async () => {
      uploadToPresignedUrl.mockRejectedValueOnce(new Error("network died"));
      const { result } = renderHook(() => useProfilePresenter());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        void result.current.uploadImage("avatar", raw);
      });
      await waitFor(() => expect(result.current.error).toMatch(/network died/));
      expect(patch).not.toHaveBeenCalled();
    });

    it("stops before uploading when even the compressed original is over the cap", async () => {
      buildUploadSet.mockResolvedValue({
        original: new File([new Uint8Array(6 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" }),
        variants: { sm, md },
      });
      const { result } = renderHook(() => useProfilePresenter());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        void result.current.uploadImage("avatar", raw);
      });
      await waitFor(() => expect(result.current.error).toMatch(/too large — max 5MB/));
      expect(uploadToPresignedUrl).not.toHaveBeenCalled();
      expect(patch).not.toHaveBeenCalled();
    });
  });
});

describe("useSecurityPresenter", () => {
  beforeEach(() => {
    twoFactorEnable.mockReset().mockResolvedValue({
      data: { totpURI: "otpauth://totp/Kinkord?secret=S", backupCodes: ["a", "b"] },
      error: null,
    });
    verifyTotp.mockReset().mockResolvedValue({ error: null });
  });

  it("turns the totpURI into a QR and confirms with a code", async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useSecurityPresenter(onChange));
    act(() => {
      void result.current.beginEnable("supersecret123");
    });
    await waitFor(() => expect(result.current.setup?.qrDataUrl).toMatch(/^data:image\/png/));
    expect(result.current.setup?.backupCodes).toHaveLength(2);

    act(() => result.current.setCode("123456"));
    act(() => {
      void result.current.confirmEnable();
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    expect(result.current.setup).toBeNull();
  });

  it("rejects short codes before calling the API", async () => {
    const { result } = renderHook(() => useSecurityPresenter());
    act(() => result.current.setCode("12"));
    act(() => {
      void result.current.confirmEnable();
    });
    await waitFor(() => expect(result.current.error).toMatch(/6-digit/));
    expect(verifyTotp).not.toHaveBeenCalled();
  });
});
