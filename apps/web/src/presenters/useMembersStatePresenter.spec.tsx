// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMembersStatePresenter } from "./useMembersStatePresenter";

const push = vi.fn();
const replace = vi.fn();
// Stable object, like Next's real router — a fresh one per render would re-run fetch effects.
const router = { push, replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const apiGet = vi.fn();
vi.mock("@/services/apiClient", () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
    }
  }
  return { api: { get: (...a: unknown[]) => apiGet(...a) }, ApiError };
});

describe("useMembersStatePresenter", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    apiGet.mockReset().mockResolvedValue([{ state: "Delta", membersCount: 1234 }]);
  });

  it("shows every configured Nigerian state as a radio row with its live count", async () => {
    const { result } = renderHook(() => useMembersStatePresenter("ng"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).toHaveBeenCalledWith("/members/states?country=NG");
    expect(result.current.title).toBe("Nigeria");
    expect(result.current.subtitle).toBe("Choose your state to find kinksters near you");
    expect(result.current.available).toBe(true);
    expect(result.current.rows).toHaveLength(37);
    expect(result.current.rows.find((r) => r.state === "Delta")).toEqual({
      state: "Delta",
      count: "1.2K",
      selected: false,
    });
    expect(result.current.rows.find((r) => r.state === "Abia")?.count).toBe("0");
    expect(result.current.membersSuffix).toBe("Members");
    expect(result.current.continueLabel).toBe("Continue");
    expect(result.current.canContinue).toBe(false);
  });

  it("selects a state, then Continue opens that state's members", async () => {
    const { result } = renderHook(() => useMembersStatePresenter("NG"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onContinue());
    expect(push).not.toHaveBeenCalled();
    act(() => result.current.onSelect("Akwa Ibom"));
    expect(result.current.rows.find((r) => r.state === "Akwa Ibom")?.selected).toBe(true);
    expect(result.current.rows.find((r) => r.state === "Delta")?.selected).toBe(false);
    expect(result.current.canContinue).toBe(true);
    act(() => result.current.onContinue());
    expect(push).toHaveBeenCalledWith("/members/ng/Akwa%20Ibom");
  });

  it("filters states by search and reports empty results", async () => {
    const { result } = renderHook(() => useMembersStatePresenter("NG"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.search.onChange("del"));
    expect(result.current.rows.map((r) => r.state)).toEqual(["Delta"]);
    act(() => result.current.search.onChange("zzz"));
    expect(result.current.rows).toEqual([]);
    expect(result.current.noResults).toBe("No states match that search.");
  });

  it("marks unlaunched countries as coming soon without calling the API", () => {
    const { result } = renderHook(() => useMembersStatePresenter("gh"));
    expect(result.current.available).toBe(false);
    expect(result.current.notAvailable).toMatch(/coming soon/i);
    expect(result.current.rows).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects to login on 401", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValueOnce(new ApiError(401, {}));
    renderHook(() => useMembersStatePresenter("ng"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
