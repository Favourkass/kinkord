import { describe, expect, it } from "vitest";
import { alias, PgDialect } from "drizzle-orm/pg-core";
import { follow } from "../db/schema";
import { visibleTo } from "./visibility";
describe("the visibility rule", () => {
  it("keeps public and own posts visible but requires accepted friendship for private posts", () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      visibleTo(
        "viewer-1",
        alias(follow, "viewer_follows_author"),
        alias(follow, "author_follows_viewer"),
      )!,
    );
    expect(sql).toContain('"post"."archived_at" is null');
    expect(sql).toContain('"post"."visibility" = $1 or "post"."author_id" = $2');
    expect(sql).toContain('from "friendship"');
    expect(sql).toContain("'accepted'");
    expect(sql).toContain('not exists (select 1 from "member_ban"');
    expect(sql).not.toContain('"viewer_follows_author"');
    expect(params).toEqual(["public", "viewer-1", "friends", "viewer-1", "viewer-1"]);
  });
});
