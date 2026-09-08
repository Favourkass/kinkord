// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMembersCountryPresenter } from "./useMembersCountryPresenter";

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

describe("useMembersCountryPresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    apiGet.mockReset().mockResolvedValue([{ code: "NG", name: "Nigeria", membersCount: 12_400 }]);
  });

  it("lists only launched countries with an abbreviated live total and no bottom-nav concerns", async () => {
    const { result } = renderHook(() => useMembersCountryPresenter());
    expect(result.current.rows[0]).toMatchObject({
      code: "NG",
      subtitle: "…",
      href: "/members/ng",
    });
    await waitFor(() => expect(result.current.rows[0].subtitle).toBe("12.4K Members"));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toMatchObject({
      name: "Nigeria",
      flag: "/app/flag-ng.svg",
      emoji: "🇳🇬",
      badge: null,
    });
    expect(result.current.heading).toBe("Available countries");
    expect(result.current.title).toBe("Select a Country");
    expect(result.current.header.backHref).toBe("/home");
    expect(result.current.noResults).toBeNull();
    expect(apiGet).toHaveBeenCalledWith("/members/countries");
  });

  it("reveals unlaunched countries as Coming Soon only when searched", async () => {
    const { result } = renderHook(() => useMembersCountryPresenter());
    await waitFor(() => expect(result.current.rows[0].subtitle).toBe("12.4K Members"));
    act(() => result.current.search.onChange("ghana"));
    expect(result.current.heading).toBe("Results");
    expect(result.current.rows).toEqual([
      {
        code: "GH",
        name: "Ghana",
        flag: null,
        emoji: "🇬🇭",
        subtitle: "Coming Soon",
        href: null,
        badge: "Coming Soon",
      },
    ]);
    act(() => result.current.search.onChange("nig"));
    expect(result.current.rows[0]).toMatchObject({ code: "NG", href: "/members/ng", badge: null });
    act(() => result.current.search.onChange("zzqx"));
    expect(result.current.rows).toEqual([]);
    expect(result.current.noResults).toBe("No country matches that search.");
  });

  it("redirects to login when the session is gone and shows an error otherwise", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValueOnce(new ApiError(401, {}));
    renderHook(() => useMembersCountryPresenter());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));

    apiGet.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useMembersCountryPresenter());
    await waitFor(() => expect(result.current.error).toMatch(/went wrong/));
    // Nigeria still renders (without a count) so the page stays usable.
    expect(result.current.rows[0]).toMatchObject({ code: "NG", subtitle: "…" });
  });
});
