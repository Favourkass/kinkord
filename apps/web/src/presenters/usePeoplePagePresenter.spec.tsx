// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePeoplePagePresenter } from "./usePeoplePagePresenter";

const replace = vi.fn();
const push = vi.fn();
const router = { push, replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const apiGet = vi.fn();
const apiPost = vi.fn();
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
      del: vi.fn(),
    },
    ApiError,
  };
});

const profile = {
  userId: "u2",
  username: "nene",
  displayName: "Naughty Neze",
  avatarUrl: null,
  coverUrl: null,
  bio: null,
  country: "NG",
  state: "Delta",
  city: "Abraka",
  age: 25,
  gender: "Female",
  orientation: null,
  relationshipStatus: null,
  bodyType: null,
  roles: [],
  interests: [],
  lookingFor: [],
  languages: [],
  joinedAt: "2023-03-10T09:00:00.000Z",
  lastSeenAt: null,
  isOnline: false,
  counts: { friends: 3, followers: 2, following: 10, mutualFriends: 0 },
  isFollowing: false,
  isSelf: false,
  nationality: null,
  occupation: null,
  limits: null,
  socialLinks: {},
  restricted: false,
  dateOfBirth: null,
  verification: { email: false, phone: false },
};
const person = (n: number) => ({
  userId: `u${n}`,
  username: `kinkster${n}`,
  displayName: `Kinkster ${n}`,
  avatarUrl: null,
  isFollowing: false,
});

describe("usePeoplePagePresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    apiPost.mockReset().mockResolvedValue({});
    apiGet.mockReset().mockImplementation((path: string) => {
      if (!path.includes("/friends")) return Promise.resolve(profile);
      const page = Number(new URL(`http://x${path}`).searchParams.get("page"));
      return Promise.resolve({ items: [person(page)], total: 2, page, limit: 30 });
    });
  });

  it("lists the requested sub-tab, pages on demand and follows optimistically", async () => {
    const { result } = renderHook(() => usePeoplePagePresenter("nene", "followers"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).toHaveBeenCalledWith("/profiles/nene/friends?tab=followers&page=1&limit=30");
    expect(result.current.title).toBe("Naughty Neze · People");
    expect(result.current.people.subTabs.map((t) => [t.label, t.active])).toEqual([
      ["Friends (3)", false],
      ["Followers (2)", true],
      ["Following (10)", false],
      ["Suggested", false],
    ]);
    expect(result.current.people.rows[0]).toMatchObject({
      handle: "@kinkster1",
      href: "/u/kinkster1",
    });
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.people.rows).toHaveLength(2));
    expect(apiGet).toHaveBeenCalledWith("/profiles/nene/friends?tab=followers&page=2&limit=30");
    expect(result.current.hasMore).toBe(false);
    expect(result.current.endText).toBe("That's everyone.");

    act(() => result.current.people.onToggleFollow(result.current.people.rows[0]));
    expect(result.current.people.rows[0].isFollowing).toBe(true);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/follows/kinkster1", {}));

    act(() => result.current.people.onSubTab("all"));
    expect(replace).toHaveBeenCalledWith("/u/nene/people?tab=all");
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/profiles/nene/friends?tab=all&page=1&limit=30"),
    );
    act(() => result.current.back());
    expect(push).toHaveBeenCalledWith("/u/nene");
  });

  it("falls back to Friends for an unknown tab and surfaces a missing member", async () => {
    const junk = renderHook(() => usePeoplePagePresenter("nene", "enemies"));
    expect(junk.result.current.people.subTabs[0].active).toBe(true);
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValue(new ApiError(404, {}));
    const missing = renderHook(() => usePeoplePagePresenter("ghost", null));
    await waitFor(() => expect(missing.result.current.error).toMatch(/couldn’t find/));
  });
});
