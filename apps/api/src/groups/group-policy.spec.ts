import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { createRefusal, groupAccess, groupReadableBy } from "./group-policy";
import { post } from "../db/schema";

describe("groupAccess", () => {
  it("lets anyone read an open group, but only members take part", () => {
    expect(groupAccess("open", null)).toEqual({
      member: false,
      pending: false,
      canRead: true,
      canPost: false,
      canModerate: false,
      isOwner: false,
    });
    expect(groupAccess("open", { role: "member", status: "active" })).toMatchObject({
      canRead: true,
      canPost: true,
      canModerate: false,
    });
  });

  it("keeps a closed group's discussions to its members; a request isn't membership", () => {
    expect(groupAccess("closed", null).canRead).toBe(false);
    expect(groupAccess("closed", { role: "member", status: "pending" })).toMatchObject({
      pending: true,
      member: false,
      canRead: false,
      canPost: false,
    });
    expect(groupAccess("closed", { role: "member", status: "active" }).canRead).toBe(true);
  });

  it("gives moderators the moderation tools and the owner the group itself", () => {
    expect(groupAccess("closed", { role: "moderator", status: "active" })).toMatchObject({
      canModerate: true,
      isOwner: false,
    });
    expect(groupAccess("open", { role: "owner", status: "active" })).toMatchObject({
      canModerate: true,
      isOwner: true,
    });
  });
});

describe("createRefusal", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const old = new Date("2026-09-01T12:00:00Z");

  it("makes creating a group part of Silver", () => {
    expect(
      createRefusal({ silver: false, admin: false, accountCreatedAt: old, owned: 0, now }),
    ).toBe("silver");
    expect(
      createRefusal({ silver: true, admin: false, accountCreatedAt: old, owned: 0, now }),
    ).toBe(null);
  });

  it("lets the founders and admins seed groups without Silver or waiting", () => {
    expect(
      createRefusal({ silver: false, admin: true, accountCreatedAt: now, owned: 0, now }),
    ).toBe(null);
  });

  it("makes a new account wait a week, and caps how many groups one member owns", () => {
    const yesterday = new Date("2026-10-19T12:00:00Z");
    expect(
      createRefusal({ silver: true, admin: false, accountCreatedAt: yesterday, owned: 0, now }),
    ).toBe("new_account");
    expect(
      createRefusal({ silver: true, admin: false, accountCreatedAt: old, owned: 5, now }),
    ).toBe("limit");
    expect(
      createRefusal({ silver: false, admin: true, accountCreatedAt: old, owned: 5, now }),
    ).toBe("limit");
  });
});

describe("groupReadableBy", () => {
  it("checks a live group that's open, or where the viewer is an active member", () => {
    const { sql: text, params } = new PgDialect().sqlToQuery(groupReadableBy("me", post.groupId));
    expect(text).toContain('"readable_group"."archived_at" is null');
    expect(text).toContain(`"readable_group"."privacy" = 'open'`);
    expect(text).toContain(`"reader_membership"."status" = 'active'`);
    expect(text).toContain('= "post"."group_id"');
    expect(params).toEqual(["me"]);
  });
});
