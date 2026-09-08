// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMembersStatePresenter } from "./useMembersStatePresenter";

const replace = vi.fn();
// Stable object, like Next's real router — a fresh one per render would re-run fetch effects.
const router = { push: vi.fn(), replace };
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
    replace.mockClear();
    apiGet.mockReset().mockResolvedValue([{ state: "Delta", membersCount: 1234 }]);
  });

  it("shows every configured Nigerian state with its live count and links into the state", async () => {
    const { result } = renderHook(() => useMembersStatePresenter("ng"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).toHaveBeenCalledWith("/members/states?country=NG");
    expect(result.current.title).toBe("Nigeria");
    expect(result.current.flag).toBe("🇳🇬");
    expect(result.current.available).toBe(true);
    expect(result.current.rows).toHaveLength(37);
    const delta = result.current.rows.find((r) => r.state === "Delta");
    expect(delta).toEqual({ state: "Delta", subtitle: "1.2K Members", href: "/members/ng/Delta" });
    expect(result.current.rows.find((r) => r.state === "Abia")?.subtitle).toBe("0 Members");
    expect(result.current.rows.find((r) => r.state === "Akwa Ibom")?.href).toBe(
      "/members/ng/Akwa%20Ibom",
    );
    expect(result.current.header.backHref).toBe("/members");
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
