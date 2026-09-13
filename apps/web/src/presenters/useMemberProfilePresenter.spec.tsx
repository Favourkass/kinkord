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
  avatarUrl: "https://s3/a_md.jpg",
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
  nationality: "NG",
  occupation: "Entrepreneur",
  limits: null,
  socialLinks: { x: "https://x.com/nene" },
  restricted: false,
  dateOfBirth: null,
  verification: { email: true, phone: false },
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
  total: 12,
  page: 1,
  limit: 5,
};

const suggestionsPage = {
  items: [
    {
      userId: "u9",
      username: "leatherlace",
      displayName: "Leather Lace",
      avatarUrl: null,
      isFollowing: false,
    },
  ],
  total: 1,
  page: 1,
  limit: 3,
};

const mediaPage = {
  items: [
    {
      id: "m1",
      kind: "avatar",
      url: "https://s3/a_md.jpg",
      fullUrl: "https://s3/a.jpg",
      createdAt: "2026-09-10T00:00:00.000Z",
      isCurrent: true,
    },
    {
      id: "m0",
      kind: "cover",
      url: "https://s3/c_md.jpg",
      fullUrl: "https://s3/c.jpg",
      createdAt: "2026-08-10T00:00:00.000Z",
      isCurrent: false,
    },
  ],
  total: 2,
  page: 1,
  limit: 60,
  restricted: false,
};

/** Route the mocked GET by path: profile, people lists (suggested included) and media. */
const routeGet =
  (profileValue: unknown = profile) =>
  (path: string) => {
    if (path.includes("tab=suggested")) return Promise.resolve(suggestionsPage);
    if (path.includes("/friends")) return Promise.resolve(friendsPage);
    if (path.includes("/media")) return Promise.resolve(mediaPage);
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
      memberSince: "10 Mar 2023",
    });
    expect(result.current.presenceText).toBe("Last seen an hour ago");
    expect(result.current.tab).toBe("about");
    expect(result.current.tabs.map((t) => t.label)).toEqual(["Posts", "About", "Media", "People"]);
    expect(result.current.heroLabels).toMatchObject({ addToStory: "Add to story", gift: "Gift" });
    expect(result.current.activeTab).toBeUndefined();
    expect(result.current.status).toBeNull();
  });

  it("stays idle until it knows whose profile to load", async () => {
    const { result } = renderHook(() => useMemberProfilePresenter(null));
    expect(result.current.loading).toBe(true);
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("opens the tab named in ?tab= and ignores unknown values", async () => {
    const people = renderHook(() => useMemberProfilePresenter("nene", "people"));
    expect(people.result.current.tab).toBe("people");
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

  it("marks your own profile: avatar tab active, never follows yourself", async () => {
    apiGet.mockImplementation(routeGet({ ...profile, isSelf: true }));
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.toggleFollow());
    expect(apiPost).not.toHaveBeenCalled();
    expect(result.current.vm?.isSelf).toBe(true);
    expect(result.current.activeTab).toBe("profile");
  });

  it("loads the People tab lazily with Friends/Followers/Following/Suggested, follows a row, offers See more", async () => {
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining("tab=all"));

    act(() => result.current.setTab("people"));
    expect(result.current.people.loading).toBe(true);
    await waitFor(() => expect(result.current.people.rows).toHaveLength(1));
    expect(apiGet).toHaveBeenCalledWith("/profiles/nene/friends?tab=all&page=1&limit=5");
    expect(result.current.people.subTabs.map((t) => t.label)).toEqual([
      "Friends (3)",
      "Followers (2.3K)",
      "Following (10)",
      "Suggested",
    ]);
    expect(result.current.people.rows[0]).toMatchObject({
      displayName: "Kinky Kay",
      handle: "@kay",
      href: "/u/kay",
      pill: false,
      isFollowing: false,
    });
    expect(result.current.people.seeMoreHref).toBe("/u/nene/people?tab=all");

    act(() => result.current.people.onToggleFollow(result.current.people.rows[0]));
    expect(result.current.people.rows[0].isFollowing).toBe(true);
    await waitFor(() => expect(result.current.people.rows[0].busy).toBe(false));
    expect(apiPost).toHaveBeenCalledWith("/follows/kay", {});

    act(() => result.current.people.onSubTab("followers"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/profiles/nene/friends?tab=followers&page=1&limit=5"),
    );
    expect(result.current.people.subTabs[1].active).toBe(true);
  });

  it("shows the Friends pill on your own friends list", async () => {
    apiGet.mockImplementation(routeGet({ ...profile, isSelf: true }));
    const { result } = renderHook(() => useMemberProfilePresenter("nene", "people"));
    await waitFor(() => expect(result.current.people.rows).toHaveLength(1));
    expect(result.current.people.rows[0].pill).toBe(true);
  });

  it("suggests kinksters through the API (same state, own area first) for the desktop column", async () => {
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.suggested.rows).toHaveLength(1));
    expect(apiGet).toHaveBeenCalledWith("/profiles/nene/friends?tab=suggested&page=1&limit=3");
    expect(result.current.suggested.rows[0]).toMatchObject({
      displayName: "Leather Lace",
      handle: "@leatherlace",
    });
    act(() => result.current.suggested.onAdd(result.current.suggested.rows[0]));
    expect(result.current.suggested.rows[0].isFollowing).toBe(true);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/follows/leatherlace", {}));
  });

  it("loads the Media tab lazily per pill, features the current photo and opens the lightbox", async () => {
    const { result } = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setTab("media"));
    await waitFor(() => expect(result.current.media.tiles).toHaveLength(2));
    expect(apiGet).toHaveBeenCalledWith("/profiles/nene/media?filter=all&page=1&limit=60");
    expect(result.current.media.countLabel).toBe("2 photos");
    expect(result.current.media.filters.map((f) => f.label)).toEqual([
      "All",
      "Profile Photo",
      "Photos",
      "Videos",
    ]);
    expect(result.current.media.tiles[0]).toMatchObject({ id: "m1", featured: true });

    act(() => result.current.media.onOpen(result.current.media.tiles[1]));
    expect(result.current.media.lightbox).toMatchObject({
      tile: { id: "m0", fullUrl: "https://s3/c.jpg" },
      canDelete: false,
    });
    act(() => result.current.media.onClose());
    expect(result.current.media.lightbox).toBeNull();

    act(() => result.current.media.onFilter("profile"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/profiles/nene/media?filter=profile&page=1&limit=60"),
    );
  });

  it("lets you delete your own photo from the lightbox and refreshes the header", async () => {
    apiGet.mockImplementation(routeGet({ ...profile, isSelf: true }));
    apiDel.mockResolvedValueOnce({
      deleted: "m1",
      profile: { avatarUrl: null, coverUrl: "https://s3/c.jpg" },
    });
    const { result } = renderHook(() => useMemberProfilePresenter("nene", "media"));
    await waitFor(() => expect(result.current.media.tiles).toHaveLength(2));
    act(() => result.current.media.onOpen(result.current.media.tiles[0]));
    expect(result.current.media.lightbox?.canDelete).toBe(true);
    act(() => result.current.media.onDelete());
    expect(result.current.media.lightbox?.confirming).toBe(true);
    act(() => result.current.media.onConfirmDelete());
    await waitFor(() => expect(result.current.media.tiles).toHaveLength(1));
    expect(apiDel).toHaveBeenCalledWith("/profile/media/m1");
    expect(result.current.media.lightbox).toBeNull();
    expect(result.current.vm?.avatarUrl).toBeNull();
    expect(result.current.media.countLabel).toBe("1 photo");
  });

  it("maps 404 to not-found, 401 to login, and other failures to an error", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValueOnce(new ApiError(404, {}));
    const missing = renderHook(() => useMemberProfilePresenter("ghost"));
    await waitFor(() => expect(missing.result.current.loading).toBe(false));
    expect(missing.result.current.status).toMatch(/couldn’t find/);

    apiGet.mockRejectedValueOnce(new ApiError(401, {}));
    renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));

    apiGet.mockRejectedValueOnce(new Error("boom"));
    const broken = renderHook(() => useMemberProfilePresenter("nene"));
    await waitFor(() => expect(broken.result.current.status).toMatch(/went wrong/));
  });
});
