// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { MemberCardPM } from "@/domain/member";
import { useMembersRegionPresenter } from "./useMembersRegionPresenter";

const replace = vi.fn();
// Stable object, like Next's real router — a fresh one per render would re-run fetch effects.
const router = { push: vi.fn(), replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDel = vi.fn();
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
      post: (...a: unknown[]) => apiPost(...a),
      del: (...a: unknown[]) => apiDel(...a),
    },
    ApiError,
  };
});

const member = (n: number, extra: Partial<MemberCardPM> = {}): MemberCardPM => ({
  userId: `u${n}`,
  username: `kinkster${n}`,
  displayName: `Kinkster ${n}`,
  avatarUrl: null,
  age: 25,
  gender: "Female",
  roles: ["Submissive", "Switch"],
  city: "Abraka",
  state: "Delta",
  isOnline: n === 1,
  lastSeenAt: null,
  postsCount: 0,
  followersCount: 10,
  isFollowing: false,
  ...extra,
});

const pageOf = (items: MemberCardPM[], total: number, page: number) =>
  Promise.resolve({ items, total, page, limit: 20 });

describe("useMembersRegionPresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    apiPost.mockReset().mockResolvedValue({});
    apiDel.mockReset().mockResolvedValue({});
    apiGet.mockReset().mockImplementation((path: string) => {
      const url = new URL(`http://x${path}`);
      const page = Number(url.searchParams.get("page"));
      const lga = url.searchParams.get("lga");
      if (lga === "Asaba") return pageOf([member(9, { city: "Asaba" })], 1, 1);
      if (page === 1) return pageOf([member(1), member(2)], 3, 1);
      return pageOf([member(3)], 3, 2);
    });
  });

  it("lists the whole state by default and renders the Figma list header + cards", async () => {
    const { result } = renderHook(() => useMembersRegionPresenter("ng", "Delta"));
    expect(result.current.title).toBe("Delta State");
    expect(result.current.subtitle).toBe("Discover like-minded members near you.");
    expect(result.current.selector.value).toBe("All regions");
    expect(result.current.selector.options.slice(0, 2)).toEqual(["All regions", "Abraka"]);
    expect(result.current.selector.searchByRegionLabel).toBe("Search by Region");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).toHaveBeenCalledWith(
      "/members?country=NG&state=Delta&page=1&limit=20&sort=recent",
    );
    expect(result.current.count).toBe("3");
    expect(result.current.foundLabel).toBe("Members Found");
    expect(result.current.sortLabel).toBe("Sort");
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.rows[0].card).toMatchObject({
      title: "kinkster1",
      ageTag: "25F",
      roles: "Submissive | Switch",
      location: "Abraka, Delta State",
      isOnline: true,
      followers: "10",
    });
    expect(result.current.rows[0].href).toBe("/u/kinkster1");
    expect(result.current.rows[0].openProfileLabel).toBe("Open kinkster1’s profile");
    expect(result.current.hasMore).toBe(true);
    expect(result.current.endText).toBeNull();
  });

  it("appends the next page on loadMore and stops at the end", async () => {
    const { result } = renderHook(() => useMembersRegionPresenter("ng", "Delta"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(apiGet).toHaveBeenLastCalledWith(
      "/members?country=NG&state=Delta&page=2&limit=20&sort=recent",
    );
    expect(result.current.hasMore).toBe(false);
    expect(result.current.endText).toMatch(/met everyone/);
    const calls = apiGet.mock.calls.length;
    act(() => result.current.loadMore());
    expect(apiGet.mock.calls.length).toBe(calls);
  });

  it("refetches for the newly tapped region and closes the sheet", async () => {
    const { result } = renderHook(() => useMembersRegionPresenter("ng", "Delta"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.selector.onOpen());
    expect(result.current.selector.open).toBe(true);
    act(() => result.current.selector.onSelect("Asaba"));
    expect(result.current.selector.open).toBe(false);
    expect(result.current.selector.value).toBe("Asaba");
    await waitFor(() => expect(result.current.count).toBe("1"));
    expect(apiGet).toHaveBeenLastCalledWith(
      "/members?country=NG&state=Delta&lga=Asaba&page=1&limit=20&sort=recent",
    );
    expect(result.current.rows[0].card.location).toBe("Asaba, Delta State");
    act(() => result.current.selector.onSelect("All regions"));
    expect(result.current.selector.value).toBe("All regions");
    await waitFor(() => expect(result.current.count).toBe("3"));
  });

  it("cycles the sort mode and refetches with it", async () => {
    const { result } = renderHook(() => useMembersRegionPresenter("ng", "Delta"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onSort());
    expect(result.current.sort).toBe("followers");
    expect(result.current.sortAria).toBe("Sort: Most followed");
    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith(
        "/members?country=NG&state=Delta&page=1&limit=20&sort=followers",
      ),
    );
  });

  it("follows optimistically, updates the count, and reverts when the API rejects", async () => {
    const { result } = renderHook(() => useMembersRegionPresenter("ng", "Delta"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.onToggleFollow(result.current.rows[0].card));
    expect(result.current.rows[0].card).toMatchObject({ isFollowing: true, followers: "11" });
    await waitFor(() => expect(result.current.rows[0].busy).toBe(false));
    expect(apiPost).toHaveBeenCalledWith("/follows/kinkster1", {});

    act(() => result.current.onToggleFollow(result.current.rows[0].card));
    await waitFor(() => expect(apiDel).toHaveBeenCalledWith("/follows/kinkster1"));
    await waitFor(() => expect(result.current.rows[0].card.isFollowing).toBe(false));

    apiPost.mockRejectedValueOnce(new Error("nope"));
    act(() => result.current.onToggleFollow(result.current.rows[1].card));
    expect(result.current.rows[1].card.isFollowing).toBe(true);
    await waitFor(() => expect(result.current.rows[1].card.isFollowing).toBe(false));
    expect(result.current.rows[1].card.followers).toBe("10");
  });

  it("handles unknown states, empty regions and expired sessions", async () => {
    const unknown = renderHook(() => useMembersRegionPresenter("ng", "Atlantis"));
    expect(unknown.result.current.unknownState).toMatch(/don’t know that state/);
    expect(unknown.result.current.loading).toBe(false);

    apiGet.mockImplementation(() => pageOf([], 0, 1));
    const empty = renderHook(() => useMembersRegionPresenter("ng", "Akwa%20Ibom"));
    expect(empty.result.current.title).toBe("Akwa Ibom State");
    await waitFor(() => expect(empty.result.current.loading).toBe(false));
    expect(empty.result.current.empty).toBe("No members in Akwa Ibom State yet. Be the first.");

    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValue(new ApiError(401, {}));
    renderHook(() => useMembersRegionPresenter("ng", "Delta"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
