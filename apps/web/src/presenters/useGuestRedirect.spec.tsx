// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGuestRedirect } from "./useGuestRedirect";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const getSession = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: { getSession: (...a: unknown[]) => getSession(...a) },
}));

describe("useGuestRedirect", () => {
  beforeEach(() => {
    replace.mockClear();
    getSession.mockReset();
  });

  it("redirects to /home when a session already exists", async () => {
    getSession.mockResolvedValue({
      data: { session: { id: "s1" }, user: { id: "u1" } },
      error: null,
    });
    renderHook(() => useGuestRedirect());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("stays on the guest screen when there is no session", async () => {
    getSession.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useGuestRedirect());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(replace).not.toHaveBeenCalled();
  });

  it("treats a failed session lookup as a guest", async () => {
    getSession.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useGuestRedirect());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(replace).not.toHaveBeenCalled();
  });
});
