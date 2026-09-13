import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { type Db } from "../db/db.module";
import { type StorageService } from "../storage/storage.service";
import { type FollowsService } from "./follows.service";
import { MembersService, ageFromDob, normalizePaging } from "./members.service";

const chain = (result: unknown) => {
  const p: unknown = new Proxy(() => p, {
    get: (_t, prop) =>
      prop === "then"
        ? (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
            Promise.resolve(result).then(res, rej)
        : () => p,
    apply: () => p,
  });
  return p;
};

/** Like `chain`, but remembers the argument of every `.where(...)` so the filter can be asserted. */
const recordingChain = (result: unknown, wheres: SQL[]) => {
  const p: unknown = new Proxy(() => p, {
    get: (_t, prop) => {
      if (prop === "then")
        return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve(result).then(res, rej);
      if (prop === "where")
        return (w: SQL) => {
          wheres.push(w);
          return p;
        };
      return () => p;
    },
    apply: () => p,
  });
  return p;
};

const renderWhere = (w: SQL) => new PgDialect().sqlToQuery(w);

const makeService = () => {
  const select = vi.fn();
  const db = { select } as unknown as Db;
  const presignDownload = vi.fn(async (key: string) => `https://s3/${key}`);
  const storage = { presignDownload } as unknown as StorageService;
  const counts = vi.fn(async () => ({ friends: 2, followers: 30, following: 9 }));
  const isFollowing = vi.fn(async () => true);
  const mutualFriendsCount = vi.fn(async () => 5);
  const resolveUserId = vi.fn(async () => "u2");
  const friends = vi.fn(async () => ({
    items: [
      {
        userId: "u3",
        username: "kay",
        displayName: "Kay",
        avatarKey: "avatars/kay.jpg",
        isFollowing: false,
      },
    ],
    total: 1,
  }));
  const mutualFriends = vi.fn(async () => ({ items: [], total: 0 }));
  const followers = vi.fn(async () => ({ items: [], total: 4 }));
  const following = vi.fn(async () => ({ items: [], total: 6 }));
  const areFriends = vi.fn(async () => false);
  const follows = {
    counts,
    isFollowing,
    mutualFriendsCount,
    resolveUserId,
    friends,
    mutualFriends,
    followers,
    following,
    areFriends,
  } as unknown as FollowsService;
  return {
    service: new MembersService(db, storage, follows),
    select,
    presignDownload,
    isFollowing,
    mutualFriendsCount,
    friends,
    mutualFriends,
    followers,
    following,
    areFriends,
  };
};

describe("ageFromDob", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  it("counts whole years, honoring whether the birthday has passed", () => {
    expect(ageFromDob("2001-09-08", now)).toBe(25);
    expect(ageFromDob("2001-09-09", now)).toBe(24);
    expect(ageFromDob("1999-01-01", now)).toBe(27);
  });
  it("returns null for missing or invalid dates", () => {
    expect(ageFromDob(null, now)).toBeNull();
    expect(ageFromDob("nope", now)).toBeNull();
    expect(ageFromDob("2030-01-01", now)).toBeNull();
  });
});

describe("normalizePaging", () => {
  it("defaults to page 1 / 20 rows and clamps abusive values", () => {
    expect(normalizePaging()).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(normalizePaging(3, 10)).toEqual({ page: 3, limit: 10, offset: 20 });
    expect(normalizePaging(0, 10_000)).toEqual({ page: 1, limit: 50, offset: 0 });
    expect(normalizePaging(2.7, 0)).toEqual({ page: 2, limit: 1, offset: 1 });
  });
});

describe("MembersService", () => {
  it("lists available countries with their member counts (0 when nobody is there yet)", async () => {
    const { service, select } = makeService();
    select.mockReturnValueOnce(chain([{ country: "NG", members: 42 }]));
    await expect(service.countries()).resolves.toEqual([
      { code: "NG", name: "Nigeria", membersCount: 42 },
    ]);
    select.mockReturnValueOnce(chain([]));
    await expect(service.countries()).resolves.toEqual([
      { code: "NG", name: "Nigeria", membersCount: 0 },
    ]);
  });

  it("returns per-state counts and drops rows with no state", async () => {
    const { service, select } = makeService();
    select.mockReturnValueOnce(
      chain([
        { state: "Delta", members: 256 },
        { state: null, members: 9 },
      ]),
    );
    await expect(service.states("ng")).resolves.toEqual([{ state: "Delta", membersCount: 256 }]);
  });

  it("maps member rows to cards: presigned avatar, derived age, follow state, paging", async () => {
    const { service, select, presignDownload } = makeService();
    select
      .mockReturnValueOnce(chain(undefined)) // follower_counts subquery (built, not awaited)
      .mockReturnValueOnce(
        chain([
          {
            userId: "u2",
            username: "raven",
            displayName: "Raven",
            avatarKey: "avatars/u2/a.jpg",
            dateOfBirth: "1998-05-01",
            gender: "Female",
            roles: ["Submissive", "Switch"],
            city: "Asaba",
            state: "Delta",
            lastSeenAt: new Date("2026-09-08T11:59:00Z"),
            isOnline: true,
            followers: 1234,
            isFollowing: false,
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ total: 256 }]));

    const result = await service.list(
      { country: "ng", state: "Delta", lga: "Asaba", sort: "recent", page: 1, limit: 20 },
      "me",
    );
    expect(result.total).toBe(256);
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(1);
    const card = result.items[0];
    expect(card.avatarUrl).toBe("https://s3/avatars/u2/a.jpg");
    expect(card.followersCount).toBe(1234);
    expect(card.isFollowing).toBe(false);
    expect(card.postsCount).toBe(0);
    expect(card.isOnline).toBe(true);
    expect(card.roles).toEqual(["Submissive", "Switch"]);
    expect(card.lastSeenAt).toBe("2026-09-08T11:59:00.000Z");
    expect(typeof card.age).toBe("number");
    // Cards render the medium size, not the full-resolution original.
    expect(presignDownload).toHaveBeenCalledWith("avatars/u2/a.jpg", "md");
  });

  it("narrows by state and LGA only when they are given: country → state → LGA", async () => {
    const run = async (params: Parameters<MembersService["list"]>[0]) => {
      const { service, select } = makeService();
      const wheres: SQL[] = [];
      select
        .mockReturnValueOnce(chain(undefined))
        .mockReturnValueOnce(recordingChain([], wheres))
        .mockReturnValueOnce(recordingChain([{ total: 0 }], wheres));
      await service.list(params, "me");
      // The rows query and the count query must apply the very same filter.
      expect(wheres).toHaveLength(2);
      expect(renderWhere(wheres[1])).toEqual(renderWhere(wheres[0]));
      return renderWhere(wheres[0]);
    };

    const country = await run({ country: "ng", sort: "recent" });
    expect(country.params).toEqual(["NG", "me"]);
    expect(country.sql).not.toMatch(/"state"|"city"/);

    const state = await run({ country: "ng", state: "Delta", sort: "recent" });
    expect(state.params).toEqual(["NG", "me", "Delta"]);
    expect(state.sql).toMatch(/"state" = /);
    expect(state.sql).not.toMatch(/"city"/);

    const lga = await run({ country: "ng", state: "Delta", lga: "Abraka", sort: "recent" });
    expect(lga.params).toEqual(["NG", "me", "Delta", "Abraka"]);

    // An LGA without a state cannot narrow anything, so it is ignored rather than applied.
    const orphanLga = await run({ country: "ng", lga: "Abraka", sort: "recent" });
    expect(orphanLga.params).toEqual(["NG", "me"]);
  });

  it("404s an unknown public profile", async () => {
    const { service, select } = makeService();
    select.mockReturnValueOnce(chain([]));
    await expect(service.publicProfile("ghost", "me")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("builds a public profile with counts, follow state and derived age (never the DOB)", async () => {
    const { service, select, isFollowing } = makeService();
    select.mockReturnValueOnce(
      chain([
        {
          u: {
            id: "u2",
            username: "nene",
            createdAt: new Date("2023-03-10T09:00:00Z"),
          },
          p: {
            displayName: "Naughty Neze",
            avatarKey: null,
            coverKey: "covers/u2/c.jpg",
            bio: "Hi",
            country: "NG",
            state: "Delta",
            city: "Abraka",
            dateOfBirth: "2000-01-01",
            gender: "Female",
            orientation: "Pansexual",
            relationshipStatus: "Single",
            bodyType: "Slim",
            roles: ["Dominant"],
            interests: ["Bondage"],
            lookingFor: [],
            languages: ["English"],
            lastSeenAt: null,
          },
        },
      ]),
    );
    const vm = await service.publicProfile("@Nene", "me");
    expect(vm.isOnline).toBe(false);
    expect(vm.lastSeenAt).toBeNull();
    expect(vm.username).toBe("nene");
    expect(vm.coverUrl).toBe("https://s3/covers/u2/c.jpg");
    expect(vm.avatarUrl).toBeNull();
    expect(vm.counts).toEqual({ friends: 2, followers: 30, following: 9, mutualFriends: 5 });
    expect(vm.isFollowing).toBe(true);
    expect(vm.isSelf).toBe(false);
    expect(vm.joinedAt).toBe("2023-03-10T09:00:00.000Z");
    expect(typeof vm.age).toBe("number");
    // Another member never receives the birth date, only the derived age.
    expect(vm.dateOfBirth).toBeNull();
    expect(isFollowing).toHaveBeenCalledWith("me", "u2");
  });

  it("marks your own profile as self and skips the follow lookup", async () => {
    const { service, select, isFollowing, mutualFriendsCount } = makeService();
    select.mockReturnValueOnce(
      chain([
        {
          u: { id: "me", username: "me", createdAt: new Date("2024-01-01T00:00:00Z") },
          p: {
            displayName: "Me",
            avatarKey: null,
            coverKey: null,
            bio: null,
            country: null,
            state: null,
            city: null,
            dateOfBirth: null,
            gender: null,
            orientation: null,
            relationshipStatus: null,
            bodyType: null,
            roles: [],
            interests: [],
            lookingFor: [],
            languages: [],
            lastSeenAt: new Date(),
          },
        },
      ]),
    );
    const vm = await service.publicProfile("me", "me");
    expect(vm.isOnline).toBe(true);
    expect(vm.isSelf).toBe(true);
    expect(vm.isFollowing).toBe(false);
    expect(isFollowing).not.toHaveBeenCalled();
    expect(vm.counts.mutualFriends).toBe(0);
    expect(mutualFriendsCount).not.toHaveBeenCalled();
  });
});

describe("MembersService.friends", () => {
  it("resolves the handle, pages the requested tab and presigns avatars", async () => {
    const { service, friends, mutualFriends } = makeService();
    const page = await service.friends("@Nene", "me", "all", 2, 10);
    expect(friends).toHaveBeenCalledWith("u2", "me", 10, 10);
    expect(page).toEqual({
      items: [
        {
          userId: "u3",
          username: "kay",
          displayName: "Kay",
          avatarUrl: "https://s3/avatars/kay.jpg",
          isFollowing: false,
        },
      ],
      total: 1,
      page: 2,
      limit: 10,
    });
    await service.friends("nene", "me", "mutual");
    expect(mutualFriends).toHaveBeenCalledWith("u2", "me", 20, 0);
  });
});

describe("MembersService.publicProfile visibility (Edit Profile → Privacy)", () => {
  const rowFor = (profileVisibility: string) => [
    {
      u: {
        id: "u2",
        username: "nene",
        emailVerified: true,
        createdAt: new Date("2023-03-10T09:00:00Z"),
      },
      p: {
        displayName: "Neze",
        avatarKey: null,
        coverKey: null,
        bio: "Hi",
        country: "NG",
        state: "Delta",
        city: "Abraka",
        dateOfBirth: "2000-01-01",
        gender: "Female",
        orientation: "Pansexual",
        relationshipStatus: "Single",
        bodyType: "Slim",
        roles: ["Dominant"],
        interests: ["Bondage"],
        lookingFor: ["Events"],
        languages: ["English"],
        lastSeenAt: null,
        nationality: "NG",
        occupation: "Entrepreneur",
        limits: "No blood",
        socialLinks: { x: "https://x.com/nene" },
        profileVisibility,
        phoneVerified: false,
      },
    },
  ];

  it("withholds the About details from non-friends on a friends-only profile, keeps the card basics", async () => {
    const { service, select, areFriends } = makeService();
    select.mockReturnValueOnce(chain(rowFor("friends")));
    const vm = await service.publicProfile("nene", "me");
    expect(areFriends).toHaveBeenCalledWith("me", "u2");
    expect(vm.restricted).toBe(true);
    expect(vm.bio).toBeNull();
    expect(vm.interests).toEqual([]);
    expect(vm.occupation).toBeNull();
    expect(vm.socialLinks).toEqual({});
    // What the directory card already shows stays, so they can still follow back.
    expect(vm.displayName).toBe("Neze");
    expect(vm.roles).toEqual(["Dominant"]);
    expect(vm.city).toBe("Abraka");
    expect(vm.counts.followers).toBe(30);
  });

  it("shows everything to friends and to the member; public profiles skip the check", async () => {
    const { service, select, areFriends } = makeService();
    areFriends.mockResolvedValueOnce(true);
    select.mockReturnValueOnce(chain(rowFor("friends")));
    const friend = await service.publicProfile("nene", "me");
    expect(friend.restricted).toBe(false);
    expect(friend.limits).toBe("No blood");
    expect(friend.nationality).toBe("NG");

    select.mockReturnValueOnce(chain(rowFor("friends")));
    const self = await service.publicProfile("nene", "u2");
    expect(self.restricted).toBe(false);
    expect(self.bio).toBe("Hi");
    // Only you see your own birth date; others get the derived age.
    expect(self.dateOfBirth).toBe("2000-01-01");
    expect(friend.dateOfBirth).toBeNull();
    expect(self.verification).toEqual({ email: true, phone: false });

    areFriends.mockClear();
    select.mockReturnValueOnce(chain(rowFor("public")));
    const pub = await service.publicProfile("nene", "me");
    expect(pub.restricted).toBe(false);
    expect(areFriends).not.toHaveBeenCalled();
  });
});

describe("MembersService people tabs + media (profile rebuild, 2026-09-12)", () => {
  it("routes each People sub-tab to its list", async () => {
    const { service, followers, following, friends, mutualFriends } = makeService();
    await service.friends("nene", "me", "followers");
    expect(followers).toHaveBeenCalledWith("u2", "me", 20, 0);
    await service.friends("nene", "me", "following");
    expect(following).toHaveBeenCalledWith("u2", "me", 20, 0);
    await service.friends("nene", "me", "all");
    expect(friends).toHaveBeenCalledWith("u2", "me", 20, 0);
    await service.friends("nene", "me", "mutual");
    expect(mutualFriends).toHaveBeenCalledWith("u2", "me", 20, 0);
  });

  it("suggests kinksters from the member's state, their own area first, never the member or viewer", async () => {
    const { service, select } = makeService();
    const wheres: SQL[] = [];
    select
      .mockReturnValueOnce(chain([{ country: "NG", state: "Delta", city: "Abraka" }]))
      .mockReturnValueOnce(
        recordingChain(
          [
            {
              userId: "u5",
              username: "ada",
              displayName: "Ada",
              avatarKey: "avatars/u5/a.jpg",
              isFollowing: null,
            },
          ],
          wheres,
        ),
      )
      .mockReturnValueOnce(recordingChain([{ total: 12 }], wheres));
    const page = await service.friends("nene", "me", "suggested", 1, 10);
    expect(page.total).toBe(12);
    expect(page.items[0]).toEqual({
      userId: "u5",
      username: "ada",
      displayName: "Ada",
      avatarUrl: "https://s3/avatars/u5/a.jpg",
      isFollowing: false,
    });
    const { params } = renderWhere(wheres[0]);
    expect(params).toEqual(["Delta", "u2", "me", "NG"]);
    expect(renderWhere(wheres[1])).toEqual(renderWhere(wheres[0]));
  });

  it("suggests nobody when the member has no state on file", async () => {
    const { service, select } = makeService();
    select.mockReturnValueOnce(chain([{ country: "NG", state: null, city: null }]));
    const page = await service.friends("nene", "me", "suggested");
    expect(page).toMatchObject({ items: [], total: 0 });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("lists uploaded profile photos with grid + full URLs and marks the current one", async () => {
    const { service, select, presignDownload } = makeService();
    select
      .mockReturnValueOnce(
        chain([{ avatarKey: "avatars/u2/new.jpg", coverKey: null, visibility: "public" }]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: "m1",
            userId: "u2",
            kind: "avatar",
            key: "avatars/u2/new.jpg",
            createdAt: new Date("2026-09-10T00:00:00Z"),
          },
          {
            id: "m0",
            userId: "u2",
            kind: "avatar",
            key: "avatars/u2/old.jpg",
            createdAt: new Date("2026-08-10T00:00:00Z"),
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ total: 2 }]));
    const page = await service.media("nene", "me", "profile");
    expect(page.total).toBe(2);
    expect(page.items.map((i) => [i.id, i.isCurrent])).toEqual([
      ["m1", true],
      ["m0", false],
    ]);
    expect(page.items[0].url).toBe("https://s3/avatars/u2/new.jpg");
    expect(presignDownload).toHaveBeenCalledWith("avatars/u2/new.jpg", "md");
    expect(presignDownload).toHaveBeenCalledWith("avatars/u2/new.jpg");
  });

  it("returns nothing for the Videos pill yet, and nothing at all to non-friends of a friends-only profile", async () => {
    const videos = makeService();
    videos.select.mockReturnValueOnce(
      chain([{ avatarKey: null, coverKey: null, visibility: "public" }]),
    );
    await expect(videos.service.media("nene", "me", "videos")).resolves.toMatchObject({
      items: [],
      total: 0,
      restricted: false,
    });
    expect(videos.select).toHaveBeenCalledTimes(1);

    const locked = makeService();
    locked.select.mockReturnValueOnce(
      chain([{ avatarKey: "avatars/u2/a.jpg", coverKey: null, visibility: "friends" }]),
    );
    await expect(locked.service.media("nene", "me", "all")).resolves.toMatchObject({
      items: [],
      restricted: true,
    });
    expect(locked.areFriends).toHaveBeenCalledWith("me", "u2");
  });
});
