// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { identifierKind, useLoginPresenter } from "./useLoginPresenter";

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

describe("identifierKind", () => {
  it("classifies emails vs usernames (@handles are usernames)", () => {
    expect(identifierKind("a@b.com")).toBe("email");
    expect(identifierKind("tegamaxwell")).toBe("username");
    expect(identifierKind("@tegamaxwell")).toBe("username");
  });
});

describe("useLoginPresenter", () => {
  beforeEach(() => {
    push.mockClear();
    signInEmail.mockReset().mockResolvedValue({ data: {}, error: null });
    signInUsername.mockReset().mockResolvedValue({ data: {}, error: null });
    verifyTotp.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  it("routes email identifiers to signIn.email and redirects on success", async () => {
    const { result } = renderHook(() => useLoginPresenter());
    act(() => {
      result.current.setIdentifier("a@b.com");
      result.current.setPassword("supersecret123");
    });
    await act(() => result.current.submit());
    expect(signInEmail).toHaveBeenCalledWith({ email: "a@b.com", password: "supersecret123" });
    expect(push).toHaveBeenCalledWith("/profile");
  });

  it("routes @handles to signIn.username, lowercased and stripped", async () => {
    const { result } = renderHook(() => useLoginPresenter());
    act(() => {
      result.current.setIdentifier("@TegaMaxwell");
      result.current.setPassword("supersecret123");
    });
    await act(() => result.current.submit());
    expect(signInUsername).toHaveBeenCalledWith({
      username: "tegamaxwell",
      password: "supersecret123",
    });
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
    expect(push).toHaveBeenCalledWith("/profile");
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
