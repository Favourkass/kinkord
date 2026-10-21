import { BadRequestException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { post } from "../db/schema";
import { MAX_TAGS, TAG_FRIENDS_ONLY, taggableIds, tags, tagSuggestions, tagsOn } from "./post-tags";

/** Each `await` takes the next queued answer; the calls are kept to check what was asked. */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  return { db: chain() as never, calls };
}

const whereOf = (calls: Array<{ op: string; args: unknown[] }>) =>
  new PgDialect().sqlToQuery(calls.find((c) => c.op === "where")?.args[0] as SQL);

describe("taggableIds", () => {
  it("asks nothing when nobody is tagged", async () => {
    const { db, calls } = queuedDb([]);
    await expect(taggableIds(db, "u1", [])).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("only takes the author's friends, nobody suspended or blocked either way, never the author", async () => {
    const { db, calls } = queuedDb([[{ id: "u2" }, { id: "u3" }]]);
    await expect(taggableIds(db, "u1", [" @Ada", "kemi", "ada"])).resolves.toEqual(["u2", "u3"]);
    const { sql, params } = whereOf(calls);
    expect(params).toEqual(expect.arrayContaining(["ada", "kemi", "u1"]));
    expect(sql).toContain('from "friendship"');
    expect(sql).toContain('"member_ban"');
    expect(sql).toContain('"member_block"');
    expect(sql).toContain('"user"."id" <>');
  });

  it("refuses the post when any tag isn't a friend, rather than quietly dropping it", async () => {
    const { db } = queuedDb([[{ id: "u2" }]]);
    await expect(taggableIds(db, "u1", ["ada", "stranger"])).rejects.toThrow(
      new BadRequestException(TAG_FRIENDS_ONLY),
    );
  });

  it(`tags at most ${MAX_TAGS} people`, async () => {
    const { db, calls } = queuedDb([]);
    const many = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `friend_${i}`);
    await expect(taggableIds(db, "u1", many)).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toHaveLength(0);
  });
});

describe("tagsOn", () => {
  it("groups each post's tags in the order they were made", async () => {
    const { db, calls } = queuedDb([
      [
        { postId: "p1", userId: "u2", username: "ada", displayName: "Ada" },
        { postId: "p2", userId: "u3", username: "kemi", displayName: "Kemi" },
        { postId: "p1", userId: "u4", username: "obi", displayName: "Obi" },
      ],
    ]);
    const byPost = await tagsOn(db, ["p1", "p2"], "viewer");
    expect(byPost.get("p1")?.map((m) => m.username)).toEqual(["ada", "obi"]);
    expect(byPost.get("p2")).toEqual([{ userId: "u3", username: "kemi", displayName: "Kemi" }]);
    // Nobody the viewer can't see: suspended, or on either side of a block with them.
    const { sql, params } = whereOf(calls);
    expect(sql).toContain('"member_ban"');
    expect(sql).toContain('"member_block"');
    expect(params).toContain("viewer");
  });

  it("asks nothing for an empty page", async () => {
    const { db, calls } = queuedDb([]);
    expect((await tagsOn(db, [], "viewer")).size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("tags", () => {
  it("is the post's own tag row for that member", () => {
    const { sql, params } = new PgDialect().sqlToQuery(tags(post.id, "u2") as SQL);
    expect(sql).toBe(
      'exists (select 1 from "post_tag" where "post_tag"."post_id" = "post"."id" and "post_tag"."user_id" = $1)',
    );
    expect(params).toEqual(["u2"]);
  });
});

describe("tagSuggestions", () => {
  it("searches the viewer's friends by name or username", async () => {
    const { db, calls } = queuedDb([[]]);
    await tagSuggestions(db, "u1", " @Ad_ ");
    const { sql, params } = whereOf(calls);
    expect(sql).toContain('from "friendship"');
    expect(sql).toContain('"user"."username" ilike');
    expect(sql).toContain('"profile"."display_name" ilike');
    // The underscore is literal, not a wildcard.
    expect(params).toContain("%Ad\\_%");
  });
});
