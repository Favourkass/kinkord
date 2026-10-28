import { describe, expect, it } from "vitest";
import { alias, PgDialect } from "drizzle-orm/pg-core";
import { post } from "../db/schema";
import {
  afterProfilePost,
  parseProfilePostCursor,
  profilePostCursor,
  profilePostPinned,
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
  it("finds a pin by the post's own id, through an alias too, and reads no privacy setting", () => {
    const original = alias(post, "original");
    const query = new PgDialect().sqlToQuery(profilePostPinned(original.id));
    expect(query.sql).toContain('post_id="original"."id"');
    // Who can see a pinned post is the post's own audience, so no audience is read here.
    expect(query.sql).not.toContain("profile_privacy");
    expect(new PgDialect().sqlToQuery(profilePostPinned(post.id)).sql).toContain(
      'post_id="post"."id"',
    );
  });
});
