// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PublicProfilePM } from "@/domain/member";
import { useMemberProfilePresenter } from "./useMemberProfilePresenter";

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

const profile: PublicProfilePM = {
  userId: "u2",
  username: "nene",
  displayName: "Naughty Neze",
  avatarUrl: null,
  coverUrl: null,
  bio: "Exploring.",
  country: "NG",
  state: "Delta",
  city: "Abraka",
  age: 25,
  gender: "Female",
  orientation: null,
  relationshipStatus: "Single",
  bodyType: null,
  roles: ["Dominant"],
  interests: [],
  lookingFor: [],
  languages: ["English"],
  joinedAt: "2023-03-10T09:00:00.000Z",
  lastSeenAt: new Date(Date.now() - 3600_000).toISOString(),
  isOnline: false,
  counts: { friends: 3, followers: 2300, following: 10, mutualFriends: 86 },
  isFollowing: false,
  isSelf: false,
};

const friendsPage = {
  items: [
    {
      userId: "u3",
      username: "kay",
      displayName: "Kinky Kay",
      avatarUrl: null,
      isFollowing: false,
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
};

const suggestionsPage = {
  items: [
    {
      userId: "u2",
      username: "nene",
      displayName: "Naughty Neze",
      avatarUrl: null,
      roles: [],
      isFollowing: false,
    },
    {
      userId: "u9",
      username: "leatherlace",
      displayName: "Leather Lace",
      avatarUrl: null,
      roles: [],
      isFollowing: false,
    },
  ],
  total: 2,
  page: 1,
  limit: 5,
};

/** Route the mocked GET by path: profile vs. friends list vs. same-state members (suggestions). */
const routeGet =
  (profileValue: unknown = profile) =>
  (path: string) => {
    if (path.includes("/friends")) return Promise.resolve(friendsPage);
    if (path.startsWith("/members?")) return Promise.resolve(suggestionsPage);
    return Promise.resolve(profileValue);
  };

describe("useMemberProfilePresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    apiGet.mockReset().mockImplementation(routeGet());
    apiPost.mockReset().mockResolvedValue({});
    apiDel.mockReset().mockResolvedValue({});
  });

  it("loads the profile, defaults to the About tab and formats presence", async () => {
    const { result } = renderHook(() => useMemberProfilePresenter("%40Nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).toHaveBeenCalledWith("/profiles/Nene");
    expect(result.current.vm).toMatchObject({
      handle: "@nene",
      locationLine: "Abraka, Delta State, Nigeria",
      tagLine: "25F · Dominant",
      stats: { friends: "3", followers: "2.3K", following: "10", mutualFriends: "86" },
    });
    expect(result.current.presenceText).toBe("Last seen an hour ago");
    expect(result.current.tab).toBe("about");
    expect(result.current.tabs.map((t) => t.label)).toEqual(["Posts", "About", "Media", "People"]);
    expect(result.current.nav.searchHref).toBe("/members");
    expect(result.current.nav.brand).toBe("KINKORD");
    expect(result.current.notFound).toBeNull();
  });

  it("opens the tab named in ?tab= and ignores unknown values", async () => {
    const friends = renderHook(() => useMemberProfilePresenter("nene", "friends"));
    expect(friends.result.current.tab).toBe("friends");
    const junk = renderHook(() => useMemberProfilePresenter("nene", "enemies"));
    expect(junk.result.current.tab).toBe("about");
    await waitFor(() => expect(junk.result.current.loading).toBe(false));
  });

  it("shows Online when the member is active", async () => {
    apiGet.mockImplementation(routeGet({ ...profile, isOnline: true }));
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.presenceText).toBe("Online");
  });

  it("follows optimistically and reverts on failure", async () => {
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.toggleFollow());
    expect(result.current.vm).toMatchObject({ isFollowing: true, stats: { followers: "2.3K" } });
    await waitFor(() => expect(result.current.followBusy).toBe(false));
    expect(apiPost).toHaveBeenCalledWith("/follows/nene", {});

    apiDel.mockRejectedValueOnce(new Error("nope"));
    act(() => result.current.toggleFollow());
    expect(result.current.vm?.isFollowing).toBe(false);
    await waitFor(() => expect(result.current.vm?.isFollowing).toBe(true));
  });

  it("never follows yourself", async () => {
    apiGet.mockImplementation(routeGet({ ...profile, isSelf: true }));
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.toggleFollow());
    expect(apiPost).not.toHaveBeenCalled();
    expect(result.current.vm?.isSelf).toBe(true);
  });

  it("loads the Friends tab lazily with All / Mutual sub-tabs and follows a friend optimistically", async () => {
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining("/friends"));

    act(() => result.current.setTab("friends"));
    expect(result.current.friends.loading).toBe(true);
    await waitFor(() => expect(result.current.friends.rows).toHaveLength(1));
    expect(apiGet).toHaveBeenCalledWith("/profiles/nene/friends?tab=all&page=1&limit=50");
    expect(result.current.friends.subTabs.map((t) => t.label)).toEqual([
      "Friends (3)",
      "Followers(2.3K)",
      "Following(10)",
      "Suggested",
    ]);
    expect(result.current.friends.rows[0]).toMatchObject({
      displayName: "Kinky Kay",
      handle: "@kay",
      isFollowing: false,
      busy: false,
    });

    act(() => result.current.friends.onToggleFollow(result.current.friends.rows[0]));
    expect(result.current.friends.rows[0].isFollowing).toBe(true);
    await waitFor(() => expect(result.current.friends.rows[0].busy).toBe(false));
    expect(apiPost).toHaveBeenCalledWith("/follows/kay", {});

    act(() => result.current.onSelectStatsTab("followers"));
    expect(result.current.tab).toBe("friends");
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/profiles/nene/friends?tab=followers&page=1&limit=50"),
    );
    expect(result.current.friends.subTabs[1].active).toBe(true);
  });

  it("suggests members from the same state, excluding the member themself", async () => {
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.suggested.rows).toHaveLength(1));
    expect(apiGet).toHaveBeenCalledWith(
      "/members?country=NG&state=Delta&page=1&limit=50&sort=recent",
    );
    expect(result.current.suggested.rows[0]).toMatchObject({
      displayName: "Leather Lace",
      handle: "@leatherlace",
    });
    expect(result.current.friends.exploreHref).toBe("/u/nene/people?tab=all");
    act(() => result.current.suggested.onAdd(result.current.suggested.rows[0]));
    expect(result.current.suggested.rows[0].isFollowing).toBe(true);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/follows/leatherlace", {}));
  });

  it("maps 404 to not-found, 401 to login, and other failures to an error", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValueOnce(new ApiError(404, {}));
    const missing = renderHook(() => useMemberProfilePresenter("ghost"));
    await waitFor(() => expect(missing.result.current.loading).toBe(false));
    expect(missing.result.current.notFound).toMatch(/couldn’t find/);

    apiGet.mockRejectedValueOnce(new ApiError(401, {}));
    renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));

    apiGet.mockRejectedValueOnce(new Error("boom"));
    const broken = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(broken.result.current.error).toMatch(/went wrong/));
  });
});
