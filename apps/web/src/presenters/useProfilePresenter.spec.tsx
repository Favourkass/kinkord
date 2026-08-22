// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useProfilePresenter, useSecurityPresenter } from "./useProfilePresenter";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const get = vi.fn();
const patch = vi.fn();
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
      patch: (...a: unknown[]) => patch(...a),
      post: vi.fn(),
    },
    uploadToPresignedUrl: vi.fn(async () => {}),
  };
});

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
