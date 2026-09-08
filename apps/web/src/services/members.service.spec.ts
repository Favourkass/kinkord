import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberCardPM, PublicProfilePM } from "@/domain/member";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDel = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    del: (...a: unknown[]) => apiDel(...a),
  },
}));

import {
  decodeParam,
  filterStates,
  hasMore,
  isCountryAvailable,
  membersApi,
  nextSort,
  mergeStateCounts,
  regionsForState,
  searchCountries,
  statesForCountry,
  toggleFollowOnCard,
  toggleFollowOnFriend,
  toggleFollowOnProfile,
} from "./members.service";

beforeEach(() => {
  apiGet.mockReset().mockResolvedValue({});
  apiPost.mockReset().mockResolvedValue({});
  apiDel.mockReset().mockResolvedValue({});
});

describe("membersApi", () => {
  it("builds the directory endpoints", async () => {
    await membersApi.countries();
    await membersApi.states("ng");
    await membersApi.page({ country: "ng", state: "Akwa Ibom", region: "Uyo", page: 2, limit: 20 });
    await membersApi.page({
      country: "ng",
      state: "Delta",
      region: "Asaba",
      page: 1,
      limit: 20,
      sort: "followers",
    });
    await membersApi.page({
      country: "ng",
      state: "Delta",
      region: null,
      page: 1,
      limit: 20,
      sort: "recent",
    });
    await membersApi.profile("@Nene");
    await membersApi.friends("@Nene", "mutual", 2, 20);
    await membersApi.follow("@nene");
    await membersApi.unfollow("nene");
    expect(apiGet.mock.calls.map((c) => c[0])).toEqual([
      "/members/countries",
      "/members/states?country=NG",
      "/members?country=NG&state=Akwa+Ibom&lga=Uyo&page=2&limit=20",
      "/members?country=NG&state=Delta&lga=Asaba&page=1&limit=20&sort=followers",
      "/members?country=NG&state=Delta&page=1&limit=20&sort=recent",
      "/profiles/Nene",
      "/profiles/Nene/friends?tab=mutual&page=2&limit=20",
    ]);
    expect(apiPost).toHaveBeenCalledWith("/follows/nene", {});
    expect(apiDel).toHaveBeenCalledWith("/follows/nene");
  });
});

describe("searchCountries", () => {
  const counts = [{ code: "NG", name: "Nigeria", membersCount: 12_400 }];

  it("shows only launched countries (with counts) when there is no query", () => {
    expect(searchCountries("", counts)).toEqual([
      {
        code: "NG",
        name: "Nigeria",
        flag: "/app/members/flag-ng.svg",
        membersCount: 12_400,
        available: true,
      },
    ]);
  });

  it("keeps counts null while they are loading", () => {
    expect(searchCountries("", null)[0].membersCount).toBeNull();
  });

  it("surfaces unlaunched countries as coming soon only once searched", () => {
    const hits = searchCountries("ghana", counts);
    expect(hits).toEqual([
      { code: "GH", name: "Ghana", flag: null, membersCount: null, available: false },
    ]);
  });

  it("lists launched matches before coming-soon matches", () => {
    const hits = searchCountries("ni", counts);
    expect(hits[0]).toMatchObject({ code: "NG", available: true, membersCount: 12_400 });
    expect(hits.slice(1).every((h) => !h.available)).toBe(true);
    expect(hits.some((h) => h.code === "NI")).toBe(true); // Nicaragua
  });

  it("returns nothing for a nonsense query", () => {
    expect(searchCountries("zzqx", counts)).toEqual([]);
  });
});

describe("states + regions", () => {
  it("knows Nigeria's configured states and regions, and nothing for other countries", () => {
    expect(statesForCountry("ng")).toContain("Delta");
    expect(statesForCountry("ng").length).toBe(37);
    expect(statesForCountry("gh")).toEqual([]);
    expect(regionsForState("NG", "Delta")[0]).toBe("Abraka");
    expect(regionsForState("NG", "Delta")).toContain("My region is not listed");
    expect(regionsForState("NG", "Nowhere")).toEqual([]);
    expect(regionsForState("GH", "Delta")).toEqual([]);
    expect(isCountryAvailable("ng")).toBe(true);
    expect(isCountryAvailable("GH")).toBe(false);
  });

  it("merges live counts onto every configured state and filters by query", () => {
    const merged = mergeStateCounts(
      ["Abia", "Delta", "Lagos"],
      [{ state: "Delta", membersCount: 42 }],
    );
    expect(merged).toEqual([
      { state: "Abia", membersCount: 0 },
      { state: "Delta", membersCount: 42 },
      { state: "Lagos", membersCount: 0 },
    ]);
    expect(filterStates(merged, " del ")).toEqual([{ state: "Delta", membersCount: 42 }]);
    expect(filterStates(merged, "")).toHaveLength(3);
  });
});

describe("optimistic follow toggles", () => {
  const card: MemberCardPM = {
    userId: "u1",
    username: "nene",
    displayName: "Nene",
    avatarUrl: null,
    age: 25,
    gender: "Female",
    roles: ["Submissive"],
    city: "Abraka",
    state: "Delta",
    isOnline: true,
    lastSeenAt: null,
    postsCount: 0,
    followersCount: 0,
    isFollowing: false,
  };

  it("flips follow state and adjusts followers without going negative", () => {
    const followed = toggleFollowOnCard(card);
    expect(followed).toMatchObject({ isFollowing: true, followersCount: 1 });
    expect(toggleFollowOnCard(followed)).toMatchObject({ isFollowing: false, followersCount: 0 });
    expect(
      toggleFollowOnCard({ ...card, isFollowing: true, followersCount: 0 }).followersCount,
    ).toBe(0);
  });

  it("does the same for a profile's counts", () => {
    const pm = {
      isFollowing: false,
      counts: { friends: 1, followers: 10, following: 3, mutualFriends: 0 },
    } as PublicProfilePM;
    const on = toggleFollowOnProfile(pm);
    expect(on.isFollowing).toBe(true);
    expect(on.counts).toEqual({ friends: 1, followers: 11, following: 3, mutualFriends: 0 });
    expect(toggleFollowOnProfile(on).counts.followers).toBe(10);
  });

  it("flips a friend row without touching anything else", () => {
    const row = {
      userId: "u1",
      username: "kay",
      displayName: "Kay",
      avatarUrl: null,
      isFollowing: false,
    };
    expect(toggleFollowOnFriend(row)).toEqual({ ...row, isFollowing: true });
  });
});

describe("nextSort", () => {
  it("cycles newest → most followed → name → newest", () => {
    expect(nextSort("recent")).toBe("followers");
    expect(nextSort("followers")).toBe("name");
    expect(nextSort("name")).toBe("recent");
  });
});

describe("hasMore / decodeParam", () => {
  it("knows when a page set is exhausted", () => {
    expect(hasMore(20, 41)).toBe(true);
    expect(hasMore(41, 41)).toBe(false);
    expect(hasMore(0, 0)).toBe(false);
  });
  it("decodes encoded params and tolerates already-decoded or malformed ones", () => {
    expect(decodeParam("Akwa%20Ibom")).toBe("Akwa Ibom");
    expect(decodeParam("Akwa Ibom")).toBe("Akwa Ibom");
    expect(decodeParam("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
