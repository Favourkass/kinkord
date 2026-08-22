// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useForgotPasswordPresenter, useResetPasswordPresenter } from "./usePasswordResetPresenter";

const requestPasswordReset = vi.fn();
const resetPassword = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: {
    requestPasswordReset: (...a: unknown[]) => requestPasswordReset(...a),
    resetPassword: (...a: unknown[]) => resetPassword(...a),
  },
}));

describe("useForgotPasswordPresenter", () => {
  beforeEach(() => requestPasswordReset.mockReset().mockResolvedValue({}));

  it("validates the email before sending", async () => {
    const { result } = renderHook(() => useForgotPasswordPresenter());
    act(() => result.current.setEmail("not-an-email"));
    await act(() => result.current.submit());
    expect(result.current.error).toBeTruthy();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("reports sent even when the API answers with an error (no account enumeration)", async () => {
    requestPasswordReset.mockResolvedValue({ data: null, error: { message: "no such user" } });
    const { result } = renderHook(() => useForgotPasswordPresenter());
    act(() => result.current.setEmail("a@b.com"));
    act(() => {
      void result.current.submit();
    });
    await waitFor(() => expect(result.current.sent).toBe(true));
    expect(result.current.error).toBeNull();
  });
});

describe("useResetPasswordPresenter", () => {
  beforeEach(() => resetPassword.mockReset().mockResolvedValue({ error: null }));

  it("enforces password rules and matching confirmation", async () => {
    const { result } = renderHook(() => useResetPasswordPresenter("tok"));
    act(() => {
      result.current.setPassword("short");
      result.current.setConfirm("short");
    });
    await act(() => result.current.submit());
    expect(result.current.error).toMatch(/10 characters/);
  });

  it("requires a token from the link", async () => {
    const { result } = renderHook(() => useResetPasswordPresenter(null));
    act(() => {
      result.current.setPassword("supersecret123");
      result.current.setConfirm("supersecret123");
    });
    await act(() => result.current.submit());
    expect(result.current.error).toMatch(/invalid or expired/i);
  });

  it("resets with the token and reports done", async () => {
    const { result } = renderHook(() => useResetPasswordPresenter("tok"));
    act(() => {
      result.current.setPassword("supersecret123");
      result.current.setConfirm("supersecret123");
    });
    await act(() => result.current.submit());
    expect(resetPassword).toHaveBeenCalledWith({ newPassword: "supersecret123", token: "tok" });
    expect(result.current.done).toBe(true);
  });
});
