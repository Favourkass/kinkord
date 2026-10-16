import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Db } from "../db/db.module";
import { friendship } from "../db/schema";
import { FriendshipsService } from "./friendships.service";
import type { FollowsService } from "./follows.service";
import type { PushService } from "../push/push.service";
import type { StorageService } from "../storage/storage.service";

function setup() {
  const wheres: unknown[] = [];
  const chain = (value: unknown): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") return Promise.resolve(value).then.bind(Promise.resolve(value));
          return (...args: unknown[]) => {
            if (prop === "where") wheres.push(args[0]);
            return chain(value);
          };
        },
      },
    );
  const select = vi.fn().mockImplementation(() => chain([]));
  const insert = vi.fn().mockImplementation(() => chain([]));
  const update = vi.fn().mockImplementation(() => chain([]));
  const del = vi.fn().mockImplementation(() => chain([]));
  const follows = {
    resolveUserId: vi.fn().mockResolvedValue("peer"),
    follow: vi.fn(),
    unfollow: vi.fn(),
  };
  const push = { friendRequest: vi.fn(), friendAccepted: vi.fn() };
  const storage = { presignDownload: vi.fn().mockResolvedValue("signed") };
  const service = new FriendshipsService(
    { select, insert, update, delete: del } as unknown as Db,
    follows as unknown as FollowsService,
    push as unknown as PushService,
    storage as unknown as StorageService,
  );
  return { service, select, insert, update, del, follows, push, wheres, chain };
}
describe("FriendshipsService", () => {
  it("refuses self requests and blocked/removed members before inserting anything", async () => {
    const s = setup();
    s.follows.resolveUserId.mockResolvedValueOnce("me");
    await expect(s.service.request("me", "me")).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.service.request("me", "peer")).rejects.toBeInstanceOf(NotFoundException);
    expect(s.insert).not.toHaveBeenCalled();
  });
  it("sends one notification for a new pending request and never follows anyone", async () => {
    const s = setup();
    s.select
      .mockReturnValueOnce(s.chain([{ id: "peer" }]))
      .mockReturnValueOnce(s.chain([{ status: "pending", requesterId: "me" }]));
    s.insert.mockReturnValueOnce(s.chain([{ id: "request-1" }]));
    await expect(s.service.request("me", "peer")).resolves.toEqual({ friendship: "outgoing" });
    expect(s.insert).toHaveBeenCalledWith(friendship);
    expect(s.push.friendRequest).toHaveBeenCalledWith("me", "peer", "request-1");
    expect(s.follows.follow).not.toHaveBeenCalled();
    expect(s.follows.unfollow).not.toHaveBeenCalled();
  });
  it("does not notify again or auto-accept a duplicate/crossed request", async () => {
    const s = setup();
    s.select
      .mockReturnValueOnce(s.chain([{ id: "peer" }]))
      .mockReturnValueOnce(s.chain([{ status: "pending", requesterId: "peer" }]));
    await expect(s.service.request("me", "peer")).resolves.toEqual({ friendship: "incoming" });
    expect(s.push.friendRequest).not.toHaveBeenCalled();
    expect(s.update).not.toHaveBeenCalled();
  });
  it("only accepts the recipient's pending request and emits one acceptance notice", async () => {
    const s = setup();
    s.select
      .mockReturnValueOnce(s.chain([{ id: "peer" }]))
      .mockReturnValueOnce(s.chain([{ status: "accepted", requesterId: "peer" }]));
    s.update.mockReturnValueOnce(s.chain([{ id: "request-1" }]));
    await expect(s.service.accept("me", "peer")).resolves.toEqual({ friendship: "friends" });
    const q = new PgDialect().sqlToQuery(s.wheres[1] as never);
    expect(q.params).toContain("pending");
    expect(q.sql).toContain('"friendship"."requester_id"');
    expect(q.params).toContain("peer");
    expect(s.push.friendAccepted).toHaveBeenCalledWith("me", "peer", "request-1");
    expect(s.follows.follow).not.toHaveBeenCalled();
  });
  it("a sender or unrelated member cannot accept a request", async () => {
    const s = setup();
    s.select
      .mockReturnValueOnce(s.chain([{ id: "peer" }]))
      .mockReturnValueOnce(s.chain([{ status: "pending", requesterId: "me" }]));
    await expect(s.service.accept("me", "peer")).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.push.friendAccepted).not.toHaveBeenCalled();
  });
  it("a late cancellation never deletes an accepted friendship", async () => {
    const s = setup();
    s.select.mockReturnValueOnce(s.chain([{ status: "accepted", requesterId: "me" }]));
    await expect(s.service.dismiss("me", "peer")).resolves.toEqual({ friendship: "friends" });
    expect(s.del).toHaveBeenCalledWith(friendship);
    expect(new PgDialect().sqlToQuery(s.wheres[0] as never).params).toContain("pending");
    expect(s.follows.unfollow).not.toHaveBeenCalled();
  });
  it("removes only accepted friendships, never any follows", async () => {
    const s = setup();
    await expect(s.service.remove("me", "peer")).resolves.toEqual({ friendship: "none" });
    expect(new PgDialect().sqlToQuery(s.wheres[0] as never).params).toContain("accepted");
    expect(s.follows.unfollow).not.toHaveBeenCalled();
  });
});
