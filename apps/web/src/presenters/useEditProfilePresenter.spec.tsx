// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEditProfilePresenter } from "./useEditProfilePresenter";

const push = vi.fn();
const replace = vi.fn();
const backNav = vi.fn();
const router = { push, replace, back: backNav };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const updateUser = vi.fn();
const signOut = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: {
    updateUser: (...a: unknown[]) => updateUser(...a),
    signOut: (...a: unknown[]) => signOut(...a),
  },
}));

const apiGet = vi.fn();
const apiPatch = vi.fn();
const apiPost = vi.fn();
const uploadToPresignedUrl = vi.fn();
vi.mock("@/services/apiClient", () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
    }
  }
  return {
    api: {
      get: (...a: unknown[]) => apiGet(...a),
      patch: (...a: unknown[]) => apiPatch(...a),
      post: (...a: unknown[]) => apiPost(...a),
    },
    ApiError,
    uploadToPresignedUrl: (...a: unknown[]) => uploadToPresignedUrl(...a),
  };
});

const me = { id: "u1", username: "tegamaxwell" };
const profile = {
  displayName: "SIR T",
  gender: "Male",
  relationshipStatus: "Head of House",
  roles: ["Sadist"],
  lookingFor: ["Events", "Relationships"],
  interests: ["DDLG", "Bondage"],
  location: "Sapele, Delta State, Nigeria",
  avatarUrl: null,
};

describe("useEditProfilePresenter", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    backNav.mockClear();
    updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
    signOut.mockReset().mockResolvedValue({});
    apiGet.mockReset().mockImplementation((path: unknown) => {
      if (path === "/me") return Promise.resolve(me);
      if (path === "/profile") return Promise.resolve(profile);
      return Promise.reject(new Error(`unexpected ${String(path)}`));
    });
    apiPatch.mockReset().mockResolvedValue({ ...profile });
    apiPost
      .mockReset()
      .mockResolvedValue({ key: "avatars/u1/x.png", uploadUrl: "u", maxSizeMb: 5 });
    uploadToPresignedUrl.mockReset().mockResolvedValue(undefined);
  });

  it("prefills the form from the profile, joining list fields", async () => {
    const { result } = renderHook(() => useEditProfilePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fields).toEqual({
      displayName: "SIR T",
      username: "@tegamaxwell",
      gender: "Male",
      relationshipStatus: "Head of House",
      role: "Sadist",
      lookingFor: "Events, Relationships",
      interests: "DDLG, Bondage",
      address: "Sapele, Delta State, Nigeria",
    });
  });

  it("saves persona fields as arrays and skips username update when unchanged", async () => {
    const { result } = renderHook(() => useEditProfilePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setField("lookingFor", "Events,  Mentorship , ");
      result.current.setField("address", " Warri, Nigeria ");
    });
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(result.current.notice).toBe("Profile saved."));
    expect(updateUser).not.toHaveBeenCalled();
    expect(apiPatch).toHaveBeenCalledWith("/profile", {
      displayName: "SIR T",
      gender: "Male",
      relationshipStatus: "Head of House",
      roles: ["Sadist"],
      lookingFor: ["Events", "Mentorship"],
      interests: ["DDLG", "Bondage"],
      location: "Warri, Nigeria",
    });
  });

  it("updates the username through better-auth when it changes", async () => {
    const { result } = renderHook(() => useEditProfilePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setField("username", "@SirTega"));
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ username: "sirtega" }));
  });

  it("uploads an avatar through the presign flow and refreshes the preview", async () => {
    apiPatch.mockResolvedValue({ ...profile, avatarUrl: "https://s3/new.png" });
    const { result } = renderHook(() => useEditProfilePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const file = new File(["x"], "me.png", { type: "image/png" });
    act(() => {
      void result.current.uploadImage("avatar", file);
    });
    await waitFor(() => expect(result.current.avatarUrl).toBe("https://s3/new.png"));
    expect(apiPost).toHaveBeenCalledWith("/profile/upload-url", {
      kind: "avatar",
      contentType: "image/png",
    });
    expect(uploadToPresignedUrl).toHaveBeenCalled();
  });

  it("redirects to login when unauthenticated", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValue(new ApiError(401, {}));
    renderHook(() => useEditProfilePresenter());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
