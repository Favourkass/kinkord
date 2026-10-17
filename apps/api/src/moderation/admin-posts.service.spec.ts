import { describe, it, expect, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import { moderationLog, post } from "../db/schema";
import { AdminPostsService } from "./admin-posts.service";
function make(answers: unknown[]) {
  const queue = [...answers];
  const calls: { op: string; args: unknown[] }[] = [];
  const chain = (): unknown =>
    new Proxy(() => {}, {
      get: (_, op) =>
        op === "then"
          ? (resolve: (x: unknown) => void) => resolve(queue.shift())
          : (...args: unknown[]) => {
              calls.push({ op: String(op), args });
              return chain();
            },
    });
  const db = chain();
  const storage = { presignDownload: vi.fn(async (key: string) => `signed:${key}`) };
  return { s: new AdminPostsService(db as never, storage as never), calls, storage };
}
const row = {
  id: "p1",
  body: "A private post",
  authorId: "other-country",
  username: "member",
  name: "Member",
  displayName: null,
  createdAt: new Date("2026-10-17"),
  visibility: "friends",
  archivedAt: null,
  deletedAt: null,
  repostOfId: null,
};
describe("AdminPostsService.list", () => {
  it("returns every location/private/blocked-author post without feed filters, with bounded stable pagination", async () => {
    const { s, calls } = make([[{ total: 41 }], [row], []]);
    const r = await s.list(2, "all");
    expect(r).toMatchObject({
      total: 41,
      page: 2,
      limit: 20,
      items: [{ id: "p1", visibility: "friends", authorId: "other-country" }],
    });
    expect(
      calls
        .filter((c) => c.op === "where")
        .slice(0, 2)
        .map((c) => c.args[0]),
    ).toEqual([undefined, undefined]);
    expect(calls.find((c) => c.op === "offset")?.args).toEqual([20]);
    expect(calls.find((c) => c.op === "limit")?.args).toEqual([20]);
    expect(calls.find((c) => c.op === "orderBy")?.args).toHaveLength(2);
  });
  it("clamps a vanished last page and does not sign media for deleted posts", async () => {
    const { s, storage } = make([[{ total: 1 }], [{ ...row, deletedAt: new Date() }]]);
    const r = await s.list(9, "deleted");
    expect(r.page).toBe(1);
    expect(r.items[0].media).toEqual([]);
    expect(storage.presignDownload).not.toHaveBeenCalled();
  });
  it("reviews video without trying to make an image thumbnail from its video key", async () => {
    const { s, storage } = make([
      [{ total: 1 }],
      [row],
      [{ id: "m", postId: "p1", kind: "video", key: "clip.mp4", posterKey: null }],
    ]);
    const result = await s.list(1, "all");
    expect(result.items[0].media[0]).toMatchObject({
      kind: "video",
      url: "signed:clip.mp4",
      thumbUrl: null,
    });
    expect(storage.presignDownload).toHaveBeenCalledTimes(1);
  });
  it("filters active vs archived explicitly", async () => {
    for (const status of ["active", "archived"] as const) {
      const { s, calls } = make([[{ total: 0 }], []]);
      await s.list(1, status);
      const sql = new PgDialect().sqlToQuery(
        calls.find((c) => c.op === "where")!.args[0] as never,
      ).sql;
      expect(sql).toContain('"post"."deleted_at" is null');
      expect(sql).toContain(`"post"."archived_at" is ${status === "active" ? "null" : "not null"}`);
    }
  });
});
describe("AdminPostsService.archive", () => {
  for (const archived of [true, false])
    it(`audits ${archived ? "archive" : "restore"} without deleting posts or media`, async () => {
      const query = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ authorId: "author" }]),
      };
      const values = vi.fn();
      const tx = { update: vi.fn(() => query), insert: vi.fn(() => ({ values })), delete: vi.fn() };
      const s = new AdminPostsService(
        { transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } as never,
        {} as never,
      );
      await expect(s.archive("admin", "p1", archived)).resolves.toEqual({ id: "p1", archived });
      expect(tx.update).toHaveBeenCalledWith(post);
      expect(tx.insert).toHaveBeenCalledWith(moderationLog);
      expect(values).toHaveBeenCalledWith({
        actorId: "admin",
        subjectUserId: "author",
        subjectPostId: "p1",
        action: archived ? "archive-post" : "restore-post",
      });
      expect(tx.delete).not.toHaveBeenCalled();
      expect(query.set.mock.calls[0][0]).toEqual({
        archivedAt: archived ? expect.any(Date) : null,
      });
    });
  it("cannot restore a deleted or missing post", async () => {
    const query = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    const tx = { update: () => query, insert: vi.fn() };
    const s = new AdminPostsService(
      { transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } as never,
      {} as never,
    );
    await expect(s.archive("admin", "p1", false)).rejects.toThrow(NotFoundException);
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
