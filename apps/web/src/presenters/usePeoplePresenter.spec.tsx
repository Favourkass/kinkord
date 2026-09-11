// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PublicProfilePM } from "@/domain/member";
import { usePeoplePresenter } from "./usePeoplePresenter";

const replace = vi.fn();
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
    {
      userId: "u4",
      username: "sam",
      displayName: "Sammy Sub",
      avatarUrl: null,
      isFollowing: true,
    },
  ],
  total: 2,
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
      city: "Warri",
      roles: [],
      isFollowing: false,
    },
    {
      userId: "u9",
      username: "leatherlace",
      displayName: "Leather Lace",
      avatarUrl: null,
      city: "Asaba",
      roles: [],
      isFollowing: false,
    },
    {
      userId: "u10",
      username: "abrakakink",
      displayName: "Abraka Kink",
      avatarUrl: null,
      city: "Abraka",
      roles: [],
      isFollowing: false,
    },
  ],
  total: 3,
  page: 1,
  limit: 50,
};

const routeGet = (path: string) => {
  if (path.includes("/friends")) return Promise.resolve(friendsPage);
  if (path.startsWith("/members?")) return Promise.resolve(suggestionsPage);
  return Promise.resolve(profile);
};

describe("usePeoplePresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    apiGet.mockReset().mockImplementation(routeGet);
    apiPost.mockReset().mockResolvedValue({});
    apiDel.mockReset().mockResolvedValue({});
  });

  it("loads profile and defaults to all friends", async () => {
    const { result } = renderHook(() => usePeoplePresenter("nene"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiGet).toHaveBeenCalledWith("/profiles/nene");
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.displayName).toBe("Naughty Neze");
    expect(result.current.handle).toBe("@nene");
    expect(result.current.backHref).toBe("/u/nene");
    expect(result.current.counts.friends).toBe("3");
  });

  it("filters rows by search query", async () => {
    const { result } = renderHook(() => usePeoplePresenter("nene"));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    act(() => result.current.onSearchChange("sam"));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].displayName).toBe("Sammy Sub");

    act(() => result.current.onSearchChange(""));
    expect(result.current.rows).toHaveLength(2);
  });

  it("loads suggested kinksters and prioritizes those in the same region/city first", async () => {
    const { result } = renderHook(() => usePeoplePresenter("nene", "suggested"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activeTab).toBe("suggested");
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    // "Abraka Kink" has city Abraka (matching Nene's city) -> should be first!
    expect(result.current.rows[0].username).toBe("abrakakink");
    expect(result.current.rows[1].username).toBe("leatherlace");
  });

  it("optimistically toggles follow on a member row", async () => {
    const { result } = renderHook(() => usePeoplePresenter("nene"));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    const first = result.current.rows[0];
    act(() => result.current.onToggleFollow(first));
    expect(result.current.rows[0].isFollowing).toBe(true);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/follows/kay", {}));
  });

  it("redirects to login on 401", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValueOnce(new ApiError(401, {}));
    renderHook(() => usePeoplePresenter("nene"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
