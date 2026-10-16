import { describe, expect, it } from "vitest";
import { alias, PgDialect } from "drizzle-orm/pg-core";
import { follow } from "../db/schema";
import { visibleTo } from "./visibility";

describe("the visibility rule", () => {
  it("shows public posts, the viewer's own, and friends-only posts only between mutual follows", () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      visibleTo(
        "viewer-1",
        alias(follow, "viewer_follows_author"),
        alias(follow, "author_follows_viewer"),
      )!,
    );
    expect(sql).toBe(
      '(not exists (select 1 from "member_ban" where "member_ban"."user_id" = "post"."author_id")' +
        ' and ("post"."visibility" = $1 or "post"."author_id" = $2 or ("post"."visibility" = $3' +
        ' and "viewer_follows_author"."follower_id" is not null and "author_follows_viewer"."follower_id" is not null)))',
    );
    expect(params).toEqual(["public", "viewer-1", "friends"]);
  });
});
