import { describe, expect, it } from "vitest";
import { alias, PgDialect } from "drizzle-orm/pg-core";
import { post } from "../db/schema";
import {
  afterProfilePost,
  parseProfilePostCursor,
  profilePostCursor,
  profilePostPinned,
  pinnedPostAllows,
} from "./profile-pins";
const ID = "00000000-0000-4000-8000-000000000001";
const at = new Date("2026-10-28T10:20:30.123Z");
describe("profile pin policy and pagination", () => {
  it.each([true, false])(
    "round trips a %s pin cursor including a deterministic tie-breaker",
    (isPinned) => {
      const cursor = parseProfilePostCursor(profilePostCursor({ id: ID, createdAt: at, isPinned }));
      expect(cursor).toEqual({ pinned: isPinned, id: ID, at: at.toISOString() });
      const query = new PgDialect().sqlToQuery(afterProfilePost(cursor!));
      expect(query.params).toEqual([isPinned, at.toISOString(), ID]);
      expect(query.sql).toContain("date_trunc('milliseconds'");
      expect(query.sql).toContain('"post"."id") <');
    },
  );
  it.each([
    "bad",
    "profile:abc",
    "profile:" +
      Buffer.from(JSON.stringify({ pinned: true, at: at.toISOString(), id: "bad" })).toString(
        "base64url",
      ),
  ])("rejects malformed cursor %s", (value) => {
    expect(() => parseProfilePostCursor(value)).toThrow("Invalid profile cursor");
  });
  it("starts without a cursor", () => expect(parseProfilePostCursor(null)).toBeNull());
  it("applies both audiences to pinned originals, including an aliased original in a repost", () => {
    const original = alias(post, "original");
    const query = new PgDialect().sqlToQuery(
      pinnedPostAllows("viewer", original.authorId, original.id),
    );
    expect(query.sql).toContain('post_id="original"."id"');
    expect(query.params.filter((p) => p === "pinnedPosts")).toHaveLength(2);
    expect(query.sql).toContain('"original"."author_id"');
    expect(new PgDialect().sqlToQuery(profilePostPinned(post.id)).sql).toContain(
      'post_id="post"."id"',
    );
  });
});
