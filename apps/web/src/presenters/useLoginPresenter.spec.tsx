// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLoginPresenter } from "./useLoginPresenter";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const signInEmail = vi.fn();
const signInUsername = vi.fn();
const verifyTotp = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: {
    signIn: {
      email: (...a: unknown[]) => signInEmail(...a),
      username: (...a: unknown[]) => signInUsername(...a),
    },
    twoFactor: { verifyTotp: (...a: unknown[]) => verifyTotp(...a) },
  },
}));

const apiPost = vi.fn();
vi.mock("@/services/apiClient", () => ({
  api: { post: (...a: unknown[]) => apiPost(...a) },
}));

describe("useLoginPresenter", () => {
  beforeEach(() => {
    push.mockClear();
    signInEmail.mockReset().mockResolvedValue({ data: {}, error: null });
    signInUsername.mockReset().mockResolvedValue({ data: {}, error: null });
    verifyTotp.mockReset().mockResolvedValue({ data: {}, error: null });
    apiPost.mockReset().mockResolvedValue({});
  });

  it("routes email identifiers to signIn.email and redirects on success", async () => {
    const { result } = renderHook(() => useLoginPresenter());
    act(() => {
      result.current.setIdentifier("a@b.com");
      result.current.setPassword("supersecret123");
    });
    await act(() => result.current.submit());
    // Stays signed in by default so reopening the app lands on /home.
    expect(signInEmail).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "supersecret123",
      rememberMe: true,
    });
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("routes @handles to signIn.username, lowercased and stripped, honoring opt-out", async () => {
    const { result } = renderHook(() => useLoginPresenter());
    act(() => {
      result.current.setIdentifier("@TegaMaxwell");
      result.current.setPassword("supersecret123");
      result.current.setRememberMe(false); // opt out of persistence (e.g. shared device)
    });
    await act(() => result.current.submit());
    expect(signInUsername).toHaveBeenCalledWith({
      username: "tegamaxwell",
      password: "supersecret123",
      rememberMe: false,
    });
  });

  it("routes phone identifiers to the phone sign-in endpoint in E.164", async () => {
    const { result } = renderHook(() => useLoginPresenter());
    act(() => {
      result.current.setIdentifier("0803 555 0142");
      result.current.setPassword("supersecret123");
    });
    await act(() => result.current.submit());
    expect(apiPost).toHaveBeenCalledWith("/auth-ext/sign-in-phone", {
      phone: "+2348035550142",
      password: "supersecret123",
      rememberMe: true,
    });
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("enters the 2FA challenge instead of redirecting when the server asks", async () => {
    signInEmail.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    const { result } = renderHook(() => useLoginPresenter());
    act(() => {
      result.current.setIdentifier("a@b.com");
      result.current.setPassword("supersecret123");
    });
    await act(() => result.current.submit());
    expect(result.current.needsTwoFactor).toBe(true);
    expect(push).not.toHaveBeenCalled();

    act(() => result.current.setCode("123456"));
    await act(() => result.current.submitTwoFactor());
    expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("surfaces sign-in errors", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { message: "Invalid credentials" } });
    const { result } = renderHook(() => useLoginPresenter());
    act(() => {
      result.current.setIdentifier("a@b.com");
      result.current.setPassword("wrong");
    });
    await act(() => result.current.submit());
    expect(result.current.error).toMatch(/Invalid credentials/);
  });
});
