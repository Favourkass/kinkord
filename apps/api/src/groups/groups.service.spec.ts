import { expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { createGroupSchema, groupShareSchema, GroupsService } from "./groups.service";
function dbMock(rows: unknown[][] = []) {
  const wheres: SQL[] = [];
  const values: unknown[] = [];
  const queue = [...rows];
  const chain: unknown = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "then"
          ? (resolve: (v: unknown) => void) => Promise.resolve(queue.shift() ?? []).then(resolve)
          : (...args: unknown[]) => {
              if (key === "where") wheres.push(args[0] as SQL);
              if (key === "values") values.push(args[0]);
              return chain;
            },
    },
  );
  const db = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    update: vi.fn(() => chain),
    execute: vi.fn(),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return { db, wheres, values };
}
it("validates group name, invite limit and captions", () => {
  expect(createGroupSchema.safeParse({ name: " " }).success).toBe(false);
  expect(
    createGroupSchema.safeParse({ name: "Friends", friends: Array(51).fill("f") }).success,
  ).toBe(false);
  expect(groupShareSchema.safeParse({ postId: "bad", caption: "" }).success).toBe(false);
});
it("requires accepted membership for reading", async () => {
  const { db, wheres } = dbMock();
  const service = new GroupsService(db as never, {} as never);
  await expect(service.requireMember("viewer", "g")).rejects.toThrow("Group not found");
  const q = new PgDialect().sqlToQuery(wheres[0]);
  expect(q.params).toContain("viewer");
  expect(q.params).toContain("joined");
  expect(q.sql).toContain("member_block");
});
it("does not share into someone else's group", async () => {
  const { db } = dbMock();
  const posts = { shareablePost: vi.fn() };
  const service = new GroupsService(db as never, posts as never);
  await expect(service.share("stranger", "g", { postId: "p", caption: "" })).rejects.toThrow();
  expect(posts.shareablePost).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalled();
});
it("checks post sharing privacy before creating a group entry", async () => {
  const { db } = dbMock([[{ id: "g", ownerId: "me", name: "Group" }]]);
  const posts = { shareablePost: vi.fn().mockRejectedValue(new Error("Private")) };
  const service = new GroupsService(db as never, posts as never);
  await expect(service.share("me", "g", { postId: "p", caption: "" })).rejects.toThrow("Private");
  expect(db.insert).not.toHaveBeenCalled();
});
it("requires an invitation and keeps other memberships untouched on acceptance", async () => {
  const { db, wheres } = dbMock([[{ id: "g", status: "invited" }], []]);
  const service = new GroupsService(db as never, {} as never);
  await service.accept("viewer", "g");
  const q = new PgDialect().sqlToQuery(wheres.at(-1)!);
  expect(q.params).toEqual(["g", "viewer"]);
});
it("rejects invitations to non-friends before writing", async () => {
  const { db } = dbMock([[]]);
  const service = new GroupsService(db as never, {} as never);
  await expect(service.create("me", { name: "Group", friends: ["stranger"] })).rejects.toThrow(
    "Invite only friends",
  );
  expect(db.transaction).not.toHaveBeenCalled();
});
it("creates the owner joined and friends invited in one transaction", async () => {
  const { db, values } = dbMock([[{ id: "friend" }], [], [{ id: "g", name: "Group" }], []]);
  const service = new GroupsService(db as never, {} as never);
  await service.create("me", { name: "Group", friends: ["friend", "friend"] });
  expect(values[1]).toEqual([
    { groupId: "g", userId: "me", status: "joined" },
    { groupId: "g", userId: "friend", status: "invited" },
  ]);
});
it("restricts deleting a group to its owner", async () => {
  const { db, wheres } = dbMock([[]]);
  const service = new GroupsService(db as never, {} as never);
  await expect(service.remove("intruder", "g")).rejects.toThrow("Group not found");
  expect(new PgDialect().sqlToQuery(wheres[0]).params).toEqual(["g", "intruder"]);
});
it("restricts removing a shared post to its author or group owner", async () => {
  const { db, wheres } = dbMock([[{ id: "g", ownerId: "owner" }], []]);
  const service = new GroupsService(db as never, {} as never);
  await expect(service.removePost("member", "g", "p")).rejects.toThrow();
  expect(new PgDialect().sqlToQuery(wheres[1]).params).toEqual(["p", "g", "member"]);
});
it("prevents the owner from leaving without deleting the group", async () => {
  const { db } = dbMock([[{ ownerId: "me" }]]);
  const service = new GroupsService(db as never, {} as never);
  await expect(service.leave("me", "g")).rejects.toThrow("owner");
  expect(db.delete).not.toHaveBeenCalled();
});

it("prevents ordinary members from inviting or removing others", async () => {
  const { db } = dbMock([[{ id: "g", ownerId: "owner" }], [{ id: "g", ownerId: "owner" }]]);
  const service = new GroupsService(db as never, {} as never);
  await expect(service.invite("member", "g", ["friend"])).rejects.toThrow("Only the owner");
  await expect(service.removeMember("member", "g", "other")).rejects.toThrow("Only the owner");
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.delete).not.toHaveBeenCalled();
});
