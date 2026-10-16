import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { type Db } from "../db/db.module";
import { FollowsService } from "./follows.service";

/**
 * Drizzle query builders are long fluent chains; this proxy returns itself for
 * any method and resolves to `result` when awaited, so each `db.<op>()` call in
 * a test maps to one queued result in call order.
 */
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

const makeDb = () => {
  const select = vi.fn();
  // An insert answers with the rows it added: none when the follow already existed.
  const insert = vi.fn(() => chain([] as unknown[]));
  const del = vi.fn(() => chain(undefined));
  const db = { select, insert, delete: del } as unknown as Db;
  return { db, select, insert, del };
};

const push = { newFollower: vi.fn() };

describe("FollowsService", () => {
  beforeEach(() => push.newFollower.mockClear());

  it("refuses to follow yourself", async () => {
    const { db, select, insert } = makeDb();
    select.mockReturnValueOnce(chain([{ id: "me" }]));
    const svc = new FollowsService(db, push as never);
    await expect(svc.follow("me", "@Me")).rejects.toBeInstanceOf(BadRequestException);
    expect(insert).not.toHaveBeenCalled();
  });

  it("404s for an unknown handle before touching the graph", async () => {
    const { db, select, insert } = makeDb();
    select.mockReturnValueOnce(chain([]));
    const svc = new FollowsService(db, push as never);
    await expect(svc.follow("me", "ghost")).rejects.toBeInstanceOf(NotFoundException);
    expect(insert).not.toHaveBeenCalled();
  });

  it("follows a member (idempotently) and returns the new follower count", async () => {
    const { db, select, insert } = makeDb();
    select.mockReturnValueOnce(chain([{ id: "u2" }])); // resolveUserId
    select.mockReturnValueOnce(chain([{ c: 3 }])); // followersCount
    insert.mockReturnValueOnce(chain([{ followerId: "me" }])); // a new follow
    const svc = new FollowsService(db, push as never);
    await expect(svc.follow("me", "@Raven")).resolves.toEqual({
      following: true,
      followersCount: 3,
    });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(push.newFollower).toHaveBeenCalledWith("me", "u2");
  });

  it("doesn't notify again when the follow already existed", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(chain([{ id: "u2" }]));
    select.mockReturnValueOnce(chain([{ c: 3 }]));
    await new FollowsService(db, push as never).follow("me", "raven");
    expect(push.newFollower).not.toHaveBeenCalled();
  });

  it("notifies on follow and re-follow, but not an existing follow or unfollow", async () => {
    const { db, select, insert } = makeDb();
    const svc = new FollowsService(db, push as never);
    for (let i = 0; i < 4; i++) {
      select.mockReturnValueOnce(chain([{ id: "u2" }]));
      select.mockReturnValueOnce(chain([{ c: 1 }]));
    }
    insert.mockReturnValueOnce(chain([{ followerId: "me" }]));
    insert.mockReturnValueOnce(chain([]));
    insert.mockReturnValueOnce(chain([{ followerId: "me" }]));
    await svc.follow("me", "raven");
    await svc.follow("me", "raven");
    expect(push.newFollower).toHaveBeenCalledTimes(1);
    await svc.unfollow("me", "raven");
    expect(push.newFollower).toHaveBeenCalledTimes(1);
    await svc.follow("me", "raven");
    expect(push.newFollower).toHaveBeenCalledTimes(2);
    expect(push.newFollower).toHaveBeenLastCalledWith("me", "u2");
  });

  it("unfollows and reports the decremented count", async () => {
    const { db, select, del } = makeDb();
    select.mockReturnValueOnce(chain([{ id: "u2" }]));
    select.mockReturnValueOnce(chain([{ c: 2 }]));
    const svc = new FollowsService(db, push as never);
    await expect(svc.unfollow("me", "raven")).resolves.toEqual({
      following: false,
      followersCount: 2,
    });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("aggregates friends (mutual), followers and following counts", async () => {
    const { db, select } = makeDb();
    select
      .mockReturnValueOnce(chain([{ c: 5 }])) // friends
      .mockReturnValueOnce(chain([{ c: 12 }])) // followers
      .mockReturnValueOnce(chain([{ c: 7 }])); // following
    const svc = new FollowsService(db, push as never);
    await expect(svc.counts("u1")).resolves.toEqual({ friends: 5, followers: 12, following: 7 });
  });

  it("treats a missing follow row as not-following", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(chain([]));
    const svc = new FollowsService(db, push as never);
    await expect(svc.isFollowing("me", "u2")).resolves.toBe(false);
  });
});

describe("FollowsService friends lists", () => {
  it("lists friends (mutual follows) with the viewer's follow state and the total", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(
      chain([
        {
          userId: "u3",
          username: "kay",
          displayName: "Kay",
          avatarKey: null,
          isFollowing: 1,
          silver: true,
        },
      ]),
    );
    select.mockReturnValueOnce(chain([{ c: 1 }]));
    const svc = new FollowsService(db, push as never);
    await expect(svc.friends("u2", "me", 20, 0)).resolves.toEqual({
      items: [
        {
          userId: "u3",
          username: "kay",
          displayName: "Kay",
          avatarKey: null,
          isFollowing: true,
          silver: true,
        },
      ],
      total: 1,
    });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("lists mutual friends, which the viewer follows by definition", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(
      chain([{ userId: "u4", username: "vee", displayName: "Vee", avatarKey: "a.jpg" }]),
    );
    select.mockReturnValueOnce(chain([{ c: 1 }]));
    const svc = new FollowsService(db, push as never);
    await expect(svc.mutualFriends("u2", "me", 20, 0)).resolves.toEqual({
      items: [
        {
          userId: "u4",
          username: "vee",
          displayName: "Vee",
          avatarKey: "a.jpg",
          isFollowing: true,
          silver: false,
        },
      ],
      total: 1,
    });
  });

  it("has no mutual friends with yourself and skips the query", async () => {
    const { db, select } = makeDb();
    const svc = new FollowsService(db, push as never);
    await expect(svc.mutualFriendsCount("me", "me")).resolves.toBe(0);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("FollowsService.areFriends", () => {
  it("is true only when both follow rows exist, and never with yourself", async () => {
    const { db, select } = makeDb();
    const svc = new FollowsService(db, push as never);
    select.mockReturnValueOnce(chain([{ c: 1 }]));
    await expect(svc.areFriends("me", "u2")).resolves.toBe(true);
    select.mockReturnValueOnce(chain([{ c: 0 }]));
    await expect(svc.areFriends("me", "u3")).resolves.toBe(false);
    await expect(svc.areFriends("me", "me")).resolves.toBe(false);
    expect(select).toHaveBeenCalledTimes(2);
  });
});

describe("FollowsService.followers / following", () => {
  it("lists followers with the viewer's follow state and the total", async () => {
    const { db, select } = makeDb();
    select
      .mockReturnValueOnce(
        chain([
          { userId: "u3", username: "kay", displayName: "Kay", avatarKey: null, isFollowing: null },
        ]),
      )
      .mockReturnValueOnce(chain([{ c: 7 }]));
    const page = await new FollowsService(db, push as never).followers("u2", "me", 20, 0);
    expect(page).toEqual({
      items: [
        {
          userId: "u3",
          username: "kay",
          displayName: "Kay",
          avatarKey: null,
          isFollowing: false,
          silver: false,
        },
      ],
      total: 7,
    });
  });

  it("lists following the same way", async () => {
    const { db, select } = makeDb();
    select
      .mockReturnValueOnce(
        chain([
          {
            userId: "u4",
            username: "vee",
            displayName: "Vee",
            avatarKey: "a.jpg",
            isFollowing: true,
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ c: 1 }]));
    const page = await new FollowsService(db, push as never).following("u2", "me", 20, 0);
    expect(page.items[0]).toMatchObject({ username: "vee", isFollowing: true });
    expect(page.total).toBe(1);
  });
});
