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
