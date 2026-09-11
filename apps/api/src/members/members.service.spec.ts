import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
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

const makeService = () => {
  const select = vi.fn();
  const db = { select } as unknown as Db;
  const presignDownload = vi.fn(async (key: string) => `https://s3/${key}`);
  const storage = { presignDownload } as unknown as StorageService;
  const counts = vi.fn(async () => ({ friends: 2, followers: 30, following: 9 }));
  const isFollowing = vi.fn(async () => true);
  const isFriend = vi.fn(async () => true);
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
  const follows = {
    counts,
    isFollowing,
    isFriend,
    mutualFriendsCount,
    resolveUserId,
    friends,
    mutualFriends,
  } as unknown as FollowsService;
  return {
    service: new MembersService(db, storage, follows),
    select,
    presignDownload,
    isFollowing,
    isFriend,
    mutualFriendsCount,
    friends,
    mutualFriends,
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
    expect(presignDownload).toHaveBeenCalledWith("avatars/u2/a.jpg");
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
    expect(vm.isFriend).toBe(true);
    expect(vm.isSelf).toBe(false);
    expect(vm.joinedAt).toBe("2023-03-10T09:00:00.000Z");
    expect(typeof vm.age).toBe("number");
    expect(vm).not.toHaveProperty("dateOfBirth");
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
