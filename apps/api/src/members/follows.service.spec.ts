import { describe, expect, it, vi } from "vitest";
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
  const insert = vi.fn(() => chain(undefined));
  const del = vi.fn(() => chain(undefined));
  const db = { select, insert, delete: del } as unknown as Db;
  return { db, select, insert, del };
};

describe("FollowsService", () => {
  it("refuses to follow yourself", async () => {
    const { db, select, insert } = makeDb();
    select.mockReturnValueOnce(chain([{ id: "me" }]));
    const svc = new FollowsService(db);
    await expect(svc.follow("me", "@Me")).rejects.toBeInstanceOf(BadRequestException);
    expect(insert).not.toHaveBeenCalled();
  });

  it("404s for an unknown handle before touching the graph", async () => {
    const { db, select, insert } = makeDb();
    select.mockReturnValueOnce(chain([]));
    const svc = new FollowsService(db);
    await expect(svc.follow("me", "ghost")).rejects.toBeInstanceOf(NotFoundException);
    expect(insert).not.toHaveBeenCalled();
  });

  it("follows a member (idempotently) and returns the new follower count", async () => {
    const { db, select, insert } = makeDb();
    select.mockReturnValueOnce(chain([{ id: "u2" }])); // resolveUserId
    select.mockReturnValueOnce(chain([{ c: 3 }])); // followersCount
    const svc = new FollowsService(db);
    await expect(svc.follow("me", "@Raven")).resolves.toEqual({
      following: true,
      followersCount: 3,
    });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("unfollows and reports the decremented count", async () => {
    const { db, select, del } = makeDb();
    select.mockReturnValueOnce(chain([{ id: "u2" }]));
    select.mockReturnValueOnce(chain([{ c: 2 }]));
    const svc = new FollowsService(db);
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
    const svc = new FollowsService(db);
    await expect(svc.counts("u1")).resolves.toEqual({ friends: 5, followers: 12, following: 7 });
  });

  it("treats a missing follow row as not-following", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(chain([]));
    const svc = new FollowsService(db);
    await expect(svc.isFollowing("me", "u2")).resolves.toBe(false);
  });
});

describe("FollowsService friends lists", () => {
  it("lists friends (mutual follows) with the viewer's follow state and the total", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(
      chain([
        { userId: "u3", username: "kay", displayName: "Kay", avatarKey: null, isFollowing: 1 },
      ]),
    );
    select.mockReturnValueOnce(chain([{ c: 1 }]));
    const svc = new FollowsService(db);
    await expect(svc.friends("u2", "me", 20, 0)).resolves.toEqual({
      items: [
        { userId: "u3", username: "kay", displayName: "Kay", avatarKey: null, isFollowing: true },
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
    const svc = new FollowsService(db);
    await expect(svc.mutualFriends("u2", "me", 20, 0)).resolves.toEqual({
      items: [
        {
          userId: "u4",
          username: "vee",
          displayName: "Vee",
          avatarKey: "a.jpg",
          isFollowing: true,
        },
      ],
      total: 1,
    });
  });

  it("lists followers with the viewer's follow state and total", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(
      chain([
        { userId: "u5", username: "fan", displayName: "Fan", avatarKey: null, isFollowing: 0 },
      ]),
    );
    select.mockReturnValueOnce(chain([{ c: 1 }]));
    const svc = new FollowsService(db);
    await expect(svc.followers("u2", "me", 20, 0)).resolves.toEqual({
      items: [
        { userId: "u5", username: "fan", displayName: "Fan", avatarKey: null, isFollowing: false },
      ],
      total: 1,
    });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("lists following with the viewer's follow state and total", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(
      chain([
        { userId: "u6", username: "idol", displayName: "Idol", avatarKey: null, isFollowing: 1 },
      ]),
    );
    select.mockReturnValueOnce(chain([{ c: 1 }]));
    const svc = new FollowsService(db);
    await expect(svc.following("u2", "me", 20, 0)).resolves.toEqual({
      items: [
        { userId: "u6", username: "idol", displayName: "Idol", avatarKey: null, isFollowing: true },
      ],
      total: 1,
    });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("checks whether two members are mutual friends", async () => {
    const { db, select } = makeDb();
    select.mockReturnValueOnce(chain([{ followerId: "u1" }]));
    select.mockReturnValueOnce(chain([{ followerId: "u2" }]));
    const svc = new FollowsService(db);
    await expect(svc.isFriend("u1", "u2")).resolves.toBe(true);

    select.mockReturnValueOnce(chain([{ followerId: "u1" }]));
    select.mockReturnValueOnce(chain([]));
    await expect(svc.isFriend("u1", "u2")).resolves.toBe(false);
  });
});
