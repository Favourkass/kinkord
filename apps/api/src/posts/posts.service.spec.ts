import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  clamp,
  createPostSchema,
  LONG_POST_NEEDS_SILVER,
  parseCursor,
  PostsService,
} from "./posts.service";
import { rankedTabPage } from "./feed-tabs";
import { post, postTag } from "../db/schema";
import { TAG_FRIENDS_ONLY } from "./post-tags";

// For You and Nearby pick their rows in feed-tabs.ts (feed-tabs.spec.ts); here
// they are stubbed per test, and the real thing runs otherwise.
vi.mock("./feed-tabs", async (importOriginal) => {
  const original = await importOriginal<typeof import("./feed-tabs")>();
  return { ...original, rankedTabPage: vi.fn(original.rankedTabPage) };
});

/**
 * Drizzle's builders are chainable and awaited at the end, so a stub returns
 * itself for every call and hands out the next queued result when awaited.
 * Queries resolve in the order they are awaited, which is the order the service
 * creates them — including inside `Promise.all`.
 */
function makeDb(results: unknown[][] = []) {
  const queue = [...results];
  const chain = (): Record<string, unknown> =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
              Promise.resolve(queue.shift() ?? []).then(resolve, reject);
          }
          return () => chain();
        },
      },
    );
  return {
    select: vi.fn(() => chain()),
    insert: vi.fn(() => chain()),
    update: vi.fn(() => chain()),
    delete: vi.fn(() => chain()),
  };
}

/** Like `makeDb`, but keeps every `.where(...)` so the generated SQL can be read back. */
function makeRecordingDb(wheres: SQL[]) {
  const chain = (): unknown => {
    const p: unknown = new Proxy(() => p, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
        }
        if (prop === "where") {
          return (w: SQL) => {
            wheres.push(w);
            return p;
          };
        }
        return () => p;
      },
      apply: () => p,
    });
    return p;
  };
  return { select: vi.fn(() => chain()) };
}

/** Wraps a stubbed query so each `.leftJoin(table, on)` keeps its `on`, to read the SQL back. */
function recordJoins(query: unknown, joins: SQL[]): unknown {
  return new Proxy(query as object, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as (...args: unknown[]) => unknown;
      if (prop === "then") return value;
      return (...args: unknown[]) => {
        if (prop === "leftJoin") joins.push(args[1] as SQL);
        return recordJoins(value(...args), joins);
      };
    },
  });
}

/** Wraps a stubbed query so its `.where(...)` is kept, to read the SQL back. */
function recordWhere(query: unknown, wheres: SQL[]): unknown {
  return new Proxy(query as object, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as (...args: unknown[]) => unknown;
      if (prop === "then") return value;
      return (...args: unknown[]) => {
        if (prop === "where") wheres.push(args[0] as SQL);
        return recordWhere(value(...args), wheres);
      };
    },
  });
}

/** A one-off chainable that resolves to `rows`, for a hand-built db stub. */
function chainOnce(rows: unknown[]): unknown {
  const p: unknown = new Proxy(() => p, {
    get: (_t, prop) =>
      prop === "then"
        ? (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve)
        : () => p,
    apply: () => p,
  });
  return p;
}

function makeStorage() {
  return {
    presignUpload: vi.fn(async (key: string) => `https://s3.test/put/${key}`),
    presignDownload: vi.fn(
      async (key: string, variant?: string) =>
        `https://s3.test/get/${key}${variant ? `?v=${variant}` : ""}`,
    ),
    describe: vi.fn(async () => ({ size: 1000, contentType: "image/jpeg" })),
    copy: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
}

const push = { newRepost: vi.fn(), newMention: vi.fn(), tagged: vi.fn() };

const service = (db = makeDb(), storage = makeStorage()) =>
  new PostsService(db as never, storage as never, push as never);

describe("createPostSchema", () => {
  it("refuses an empty post", () => {
    const result = createPostSchema.safeParse({ body: "   ", media: [] });
    expect(result.success).toBe(false);
  });

  it("accepts photos with no words", () => {
    const result = createPostSchema.safeParse({ media: [{ key: "posts/u1/a.jpg" }] });
    expect(result.success).toBe(true);
    expect(result.success && result.data.media[0].kind).toBe("image");
  });

  it("defaults to a public post", () => {
    const result = createPostSchema.safeParse({ body: "hello" });
    expect(result.success && result.data.visibility).toBe("public");
  });

  it("caps the photos per post at four", () => {
    const media = Array.from({ length: 5 }, (_, i) => ({ key: `posts/u1/${i}.jpg` }));
    expect(createPostSchema.safeParse({ media }).success).toBe(false);
  });
});

describe("clamp / parseCursor", () => {
  it("holds a page size inside its bounds", () => {
    expect(clamp(0, 1, 30)).toBe(1);
    expect(clamp(99, 1, 30)).toBe(30);
    expect(clamp(12, 1, 30)).toBe(12);
  });

  it("treats a junk cursor as the top of the feed rather than an error", () => {
    expect(parseCursor("not-a-date")).toBeNull();
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor("2026-09-18T10:00:00.000Z")?.toISOString()).toBe("2026-09-18T10:00:00.000Z");
  });
});

describe("PostsService.presignMediaUpload", () => {
  it("signs the original and every stored size under the member's own prefix", async () => {
    const storage = makeStorage();
    const result = await service(makeDb(), storage).presignMediaUpload("u1", "image/jpeg");

    expect(result.key).toMatch(/^posts\/u1\/[0-9a-f-]{36}\.jpg$/);
    expect(result.variantUploadUrls.sm).toContain("_sm.jpg");
    expect(result.variantUploadUrls.md).toContain("_md.jpg");
    expect(storage.presignUpload).toHaveBeenCalledTimes(3);
  });

  it("rejects a type S3 would happily store but the app cannot render", async () => {
    await expect(service().presignMediaUpload("u1", "application/pdf")).rejects.toThrow(
      /contentType/,
    );
  });

  it("rejects an oversize declaration before a byte is uploaded", async () => {
    await expect(
      service().presignMediaUpload("u1", "image/jpeg", 11 * 1024 * 1024),
    ).rejects.toThrow(/too large/i);
  });
});

describe("PostsService.notifyMentions", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("tells mentioned members who can see the post, never the writer or the excepted", async () => {
    push.newMention.mockClear();
    const svc = service(
      makeDb([
        [
          { username: "self", id: "u1" },
          { username: "two", id: "u2" },
          { username: "three", id: "u3" },
          { username: "four", id: "u4" },
        ],
      ]),
    );
    // u3 can't see this friends-only post: a link would only say "not found".
    vi.spyOn(svc, "canSee").mockImplementation(async (_post, viewer) => viewer !== "u3");
    svc.notifyMentions("p1", "u1", "@self @two @three @four @ghost", ["u4"]);
    await settle();
    expect(push.newMention.mock.calls).toEqual([["p1", "u2", "u1"]]);
  });

  it("asks nothing when nobody is mentioned, and never fails the post", async () => {
    const db = makeDb();
    service(db).notifyMentions("p1", "u1", "no handles here");
    expect(db.select).not.toHaveBeenCalled();
    const broken = {
      ...makeDb(),
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    expect(() => service(broken).notifyMentions("p1", "u1", "@ada hi")).not.toThrow();
    await settle();
  });
});

describe("PostsService.create", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
  });

  it("keeps a Basic member's post to 2,000 characters", async () => {
    await expect(
      service(makeDb([[]]), storage).create("u1", {
        body: "x".repeat(2001),
        visibility: "public",
        media: [],
      }),
    ).rejects.toThrow(LONG_POST_NEEDS_SILVER);
  });

  it("lets a Silver member write a longer post", async () => {
    const silver = [{ end: new Date(Date.now() + 86_400_000) }];
    // Past the length check, it fails on the media instead.
    await expect(
      service(makeDb([silver]), storage).create("u1", {
        body: "x".repeat(25_000),
        visibility: "public",
        media: [{ key: "posts/u2/stolen.jpg", kind: "image" }],
      }),
    ).rejects.toThrow(/unknown upload/);
  });

  it("caps everyone at Silver's 25,000 characters", () => {
    const parse = (body: string) =>
      createPostSchema.safeParse({ body, visibility: "public" }).success;
    expect(parse("x".repeat(25_000))).toBe(true);
    expect(parse("x".repeat(25_001))).toBe(false);
  });

  it("refuses a key belonging to somebody else", async () => {
    await expect(
      service(makeDb(), storage).create("u1", {
        visibility: "public",
        media: [{ key: "posts/u2/stolen.jpg", kind: "image" }],
      }),
    ).rejects.toThrow(/unknown upload/);
    expect(storage.describe).not.toHaveBeenCalled();
  });

  it("refuses a key that never landed in the bucket", async () => {
    storage.describe.mockResolvedValueOnce(null as never);
    await expect(
      service(makeDb(), storage).create("u1", {
        visibility: "public",
        media: [{ key: "posts/u1/ghost.jpg", kind: "image" }],
      }),
    ).rejects.toThrow(/upload not found/);
  });

  it("deletes and rejects an upload that turned out to be too big", async () => {
    storage.describe.mockResolvedValueOnce({
      size: 20 * 1024 * 1024,
      contentType: "image/jpeg",
    } as never);
    await expect(
      service(makeDb(), storage).create("u1", {
        visibility: "public",
        media: [{ key: "posts/u1/huge.jpg", kind: "image" }],
      }),
    ).rejects.toThrow(/too large/i);
    expect(storage.remove).toHaveBeenCalledWith("posts/u1/huge.jpg");
  });
});

describe("PostsService tags", () => {
  beforeEach(() => push.tagged.mockReset());

  it("checks the tags before anything is written, and refuses a post tagging a non-friend", async () => {
    const db = makeDb([[{ id: "u2" }]]);
    await expect(
      service(db).create("u1", {
        body: "With friends",
        visibility: "public",
        media: [],
        tags: ["@ada", "kemi"],
      }),
    ).rejects.toThrow(TAG_FRIENDS_ONLY);
    expect(db.insert).not.toHaveBeenCalled();
    expect(push.tagged).not.toHaveBeenCalled();
  });

  it("records each tag and tells each friend", async () => {
    const db = makeDb([[{ id: "u2" }, { id: "u3" }], [{ id: "p1" }]]);
    // The stub has no row to read the new post back with; what was written is what counts.
    await expect(
      service(db).create("u1", {
        body: "With friends",
        visibility: "public",
        media: [],
        tags: ["ada", "kemi"],
      }),
    ).rejects.toThrow("Post not found");
    expect(db.insert.mock.calls.map((c: unknown[]) => c[0])).toEqual([post, postTag]);
    expect(push.tagged.mock.calls).toEqual([
      ["p1", "u2", "u1"],
      ["p1", "u3", "u1"],
    ]);
  });

  it("lets a tagged member take their own tag off, and only theirs", async () => {
    const tagged = makeDb([
      [{ postId: "p1" }],
      [{ postId: "p1", userId: "u3", username: "kemi", displayName: "Kemi" }],
    ]);
    await expect(service(tagged).removeTag("u2", "p1")).resolves.toEqual({
      postId: "p1",
      tagged: [{ userId: "u3", username: "kemi", displayName: "Kemi" }],
      taggedMe: false,
    });
    const untagged = makeDb([[]]);
    await expect(service(untagged).removeTag("u9", "p1")).rejects.toThrow(
      "You aren't tagged in this post.",
    );
  });

  it("offers the viewer's friends to tag, with their photos", async () => {
    const db = makeDb([
      [{ userId: "u2", username: "ada", displayName: "Ada", avatarKey: "avatars/u2/a.jpg" }],
    ]);
    await expect(service(db).tagSuggestions("u1", "ad")).resolves.toEqual({
      items: [
        {
          userId: "u2",
          username: "ada",
          displayName: "Ada",
          avatarUrl: "https://s3.test/get/avatars/u2/a.jpg?v=sm",
        },
      ],
    });
  });
});

describe("PostsService.remove", () => {
  it("refuses to delete a post the caller did not write", async () => {
    const db = makeDb([[{ authorId: "someone-else", deletedAt: null }]]);
    await expect(service(db).remove("p1", "u1")).rejects.toThrow(/isn't your post/);
  });

  it("is a 404 for a post that is already gone", async () => {
    const db = makeDb([[{ authorId: "u1", deletedAt: new Date() }]]);
    await expect(service(db).remove("p1", "u1")).rejects.toThrow(/not found/i);
  });

  it("removing your repost touches your own row, never the post it points at", async () => {
    // The card shows the original author's words, so the one thing this must
    // not do is delete their post.
    const storage = makeStorage();
    const wheres: SQL[] = [];
    const db = makeRecordingDb(wheres) as unknown as ReturnType<typeof makeDb>;
    const repostRow = { authorId: "u1", deletedAt: null };
    let call = 0;
    db.select = vi.fn(() => {
      call += 1;
      return chainOnce(call === 1 ? [repostRow] : []);
    }) as never;
    db.update = vi.fn(() => chainOnce([])) as never;

    await service(db, storage).remove("r1", "u1");

    // Nothing was read or removed for the original post's media.
    expect(storage.remove).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("soft-deletes the row and clears every stored size from the bucket", async () => {
    const storage = makeStorage();
    // select the post, await the soft-delete update, then select its media.
    const db = makeDb([[{ authorId: "u1", deletedAt: null }], [], [{ key: "posts/u1/a.jpg" }]]);

    await expect(service(db, storage).remove("p1", "u1")).resolves.toEqual({ deleted: "p1" });

    expect(db.update).toHaveBeenCalled();
    expect(storage.remove.mock.calls.map((c) => c[0])).toEqual([
      "posts/u1/a.jpg",
      "posts/u1/a_sm.jpg",
      "posts/u1/a_md.jpg",
    ]);
  });
});

describe("PostsService.removeAsModerator", () => {
  it("removes someone else's post and says whose it was", async () => {
    const storage = makeStorage();
    const db = makeDb([[{ authorId: "u9", deletedAt: null }], [], [{ key: "posts/u9/a.jpg" }]]);

    await expect(service(db, storage).removeAsModerator("p1")).resolves.toEqual({
      deleted: "p1",
      authorId: "u9",
    });
    expect(db.update).toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledTimes(3);
  });

  it("is a 404 for a post that is already gone", async () => {
    const db = makeDb([[{ authorId: "u9", deletedAt: new Date() }]]);
    await expect(service(db).removeAsModerator("p1")).rejects.toThrow(/not found/i);
  });
});

describe("PostsService.byId", () => {
  const row = {
    id: "p1",
    body: "hello",
    visibility: "public" as const,
    createdAt: new Date("2026-09-18T09:00:00.000Z"),
    authorId: "u2",
    repostOfId: null,
    username: "tega",
    displayName: "Sir T",
    avatarKey: "avatars/u2/a.jpg",
  };

  it("returns null when nothing visible matches", async () => {
    await expect(service(makeDb([[]])).byId("p1", "u1")).resolves.toBeNull();
  });

  /** decorate() reads, in order: media, likes, comments, reposts, liked, reposted, saved. */
  const decorated = (over: Partial<Record<string, unknown[]>> = {}) => [
    over.media ?? [],
    over.likes ?? [],
    over.comments ?? [],
    over.reposts ?? [],
    over.liked ?? [],
    over.reposted ?? [],
    over.saved ?? [],
    over.gifts ?? [],
  ];

  it("carries the counts, the viewer's own reactions, and a small avatar", async () => {
    const storage = makeStorage();
    const db = makeDb([
      [row],
      ...decorated({
        media: [{ id: "m1", postId: "p1", kind: "image", key: "posts/u2/a.jpg", position: 0 }],
        likes: [{ postId: "p1", n: 3 }],
        gifts: [{ postId: "p1", n: 5 }],
        comments: [{ postId: "p1", n: 2 }],
        reposts: [{ postId: "p1", n: 9 }],
        liked: [{ postId: "p1" }],
        reposted: [{ postId: "p1" }],
        saved: [{ postId: "p1" }],
      }),
    ]);

    const vm = await service(db, storage).byId("p1", "u1");

    expect(vm).toMatchObject({
      id: "p1",
      postId: "p1",
      likes: 3,
      gifts: 5,
      comments: 2,
      reposts: 9,
      likedByMe: true,
      repostedByMe: true,
      savedByMe: true,
      repostedBy: null,
      mine: false,
      author: { username: "tega", displayName: "Sir T", silver: false },
    });
    expect(vm?.media[0].thumbUrl).toContain("v=md");
    expect(storage.presignDownload).toHaveBeenCalledWith("avatars/u2/a.jpg", "sm");
  });

  it("links only the @handles that are members", async () => {
    const db = makeDb([
      [{ ...row, body: "brunch with @Tega and @ghost" }],
      ...decorated(),
      [{ username: "tega" }],
    ]);
    const vm = await service(db, makeStorage()).byId("p1", "u1");
    expect(vm?.mentions).toEqual([{ handle: "tega", username: "tega" }]);
  });

  it("shows the Silver check on an author who has it", async () => {
    const db = makeDb([[{ ...row, silver: true }], ...decorated({})]);
    const vm = await service(db, makeStorage()).byId("p1", "u1");
    expect(vm?.author.silver).toBe(true);
  });

  it("marks a member's own post so the delete menu can appear", async () => {
    const db = makeDb([[{ ...row, authorId: "u1" }], ...decorated()]);
    const vm = await service(db).byId("p1", "u1");
    expect(vm?.mine).toBe(true);
    expect(vm?.likedByMe).toBe(false);
    expect(vm?.savedByMe).toBe(false);
  });

  it("shows a repost as the post it points at, credited to whoever reposted it", async () => {
    const repostRow = {
      ...row,
      id: "r1",
      body: null,
      authorId: "u1",
      repostOfId: "p1",
      username: "favour",
      displayName: "Favour",
      avatarKey: null,
    };
    const db = makeDb([
      [repostRow],
      // originalsById
      [row],
      ...decorated({ likes: [{ postId: "p1", n: 4 }] }),
    ]);

    const vm = await service(db).byId("r1", "u1");

    // The row is the repost (delete removes that), the content is the original.
    expect(vm?.id).toBe("r1");
    expect(vm?.postId).toBe("p1");
    expect(vm?.body).toBe("hello");
    expect(vm?.author.displayName).toBe("Sir T");
    expect(vm?.repostedBy).toEqual({ userId: "u1", username: "favour", displayName: "Favour" });
    expect(vm?.likes).toBe(4);
    expect(vm?.mine).toBe(true);
  });

  it("says whether the viewer follows the author, so a card needs no profile request", async () => {
    const followed = makeDb([[{ ...row, viewerFollowsAuthor: true }], ...decorated()]);
    expect((await service(followed).byId("p1", "u1"))?.author.isFollowing).toBe(true);
    const stranger = makeDb([[{ ...row, viewerFollowsAuthor: false }], ...decorated()]);
    expect((await service(stranger).byId("p1", "u1"))?.author.isFollowing).toBe(false);
  });

  it("takes a repost's follow from the original's author, not from whoever reposted it", async () => {
    const repostRow = {
      ...row,
      id: "r1",
      body: null,
      authorId: "u1",
      repostOfId: "p1",
      viewerFollowsAuthor: false,
    };
    const joins: SQL[] = [];
    const db = makeDb([[repostRow], [{ ...row, viewerFollowsAuthor: true }], ...decorated()]);
    const recorded = { ...db, select: vi.fn(() => recordJoins(db.select(), joins)) };

    const vm = await service(recorded as never).byId("r1", "viewer-1");

    expect(vm?.author).toMatchObject({ userId: "u2", isFollowing: true });
    // The originals query joins the viewer's own follow of each original's author.
    const original = new PgDialect().sqlToQuery(joins.at(-1)!);
    expect(original.sql).toContain('"viewer_follows_author"."follower_id" = $1');
    expect(original.sql).toContain('"viewer_follows_author"."following_id" = "post"."author_id"');
    expect(original.params).toEqual(expect.arrayContaining(["viewer-1"]));
  });

  it("drops a repost whose original has been deleted rather than showing a hole", async () => {
    const repostRow = { ...row, id: "r1", body: null, authorId: "u1", repostOfId: "gone" };
    // originalsById finds nothing: the original is deleted or no longer public.
    const db = makeDb([[repostRow], []]);
    await expect(service(db).byId("r1", "u1")).resolves.toBeNull();
  });
});

describe("the feed's visibility rules", () => {
  /**
   * There is no database in CI, so the one thing that must not silently rot is
   * the SQL itself: a wrong join or a dropped clause here would show one
   * member's friends-only posts to strangers.
   */
  const feedSql = async (params = {}) => {
    const wheres: SQL[] = [];
    const svc = new PostsService(
      makeRecordingDb(wheres) as never,
      makeStorage() as never,
      push as never,
    );
    await svc.feed("viewer-1", params);
    return new PgDialect().sqlToQuery(wheres[0]);
  };

  it("shows public posts, the viewer's own, and private posts only between accepted friends", async () => {
    const { sql, params } = await feedSql();

    expect(sql).toContain('"post"."deleted_at" is null');
    expect(sql).toContain('"post"."visibility" = $1 or "post"."author_id" = $2');
    // Private posts require an accepted friendship, not mutual follows.
    expect(sql).toContain('from "friendship"');
    expect(sql).toContain("'accepted'");
    expect(params.slice(0, 3)).toEqual(["public", "viewer-1", "friends"]);
  });

  it("narrows a profile's Posts tab to that member's own rows", async () => {
    // A member's Posts tab must show what they wrote and what they reposted —
    // never a post of somebody else's that they only liked or commented on.
    // A repost row carries the reposter as its author, so one filter covers both.
    const wheres: SQL[] = [];
    const svc = new PostsService(
      makeRecordingDb(wheres) as never,
      makeStorage() as never,
      push as never,
    );
    vi.spyOn(svc as never, "resolveAuthor").mockResolvedValue("u2" as never);

    await svc.feed("viewer-1", { author: "tega" });
    const { sql, params } = new PgDialect().sqlToQuery(wheres[0]);

    expect(sql.replace(/\$[0-9]+/g, "?")).toContain('"post"."author_id" = ?');
    expect(params).toContain("u2");
  });

  it("narrows a profile's Tagged tab to the posts that tag that member", async () => {
    const wheres: SQL[] = [];
    const svc = new PostsService(
      makeRecordingDb(wheres) as never,
      makeStorage() as never,
      push as never,
    );
    vi.spyOn(svc as never, "resolveAuthor").mockResolvedValue("u2" as never);

    await svc.feed("viewer-1", { tagged: "tega", tab: "for_you" });
    const { sql, params } = new PgDialect().sqlToQuery(wheres[0]);

    // The tab is ignored, as for a profile's Posts tab: newest first, every visible post.
    expect(sql).toContain('from "post_tag" where "post_tag"."post_id" = "post"."id"');
    expect(params).toContain("u2");
  });

  it("pages by timestamp so a post arriving mid-scroll cannot shift the page", async () => {
    const { sql, params } = await feedSql({ cursor: "2026-09-18T09:00:00.000Z" });
    expect(sql.replace(/\$[0-9]+/g, "?")).toContain('"post"."created_at" < ?');
    expect(params).toContain("2026-09-18T09:00:00.000Z");
  });

  it("searches post text within the same visibility rules, wildcards taken literally", async () => {
    const { sql, params } = await feedSql({ q: "50%_off" });
    expect(sql).toContain('"post"."visibility" = $1 or "post"."author_id" = $2');
    expect(sql.replace(/\$[0-9]+/g, "?")).toContain('"post"."body" ilike ?');
    expect(params).toContain("%50\\%\\_off%");
  });

  it("leaves the cursor out of the query on the first page", async () => {
    const { sql } = await feedSql();
    expect(sql).not.toContain('"post"."created_at" <');
  });

  it("reads whether the viewer follows each author off the rule's own join", async () => {
    const db = makeRecordingDb([]);
    await new PostsService(db as never, makeStorage() as never, push as never).feed("viewer-1");
    const [fields] = db.select.mock.calls[0] as unknown as [{ viewerFollowsAuthor: SQL }];
    expect(new PgDialect().sqlToQuery(fields.viewerFollowsAuthor).sql).toBe(
      '"viewer_follows_author"."follower_id" is not null',
    );
  });
});

describe("the home feed's tabs", () => {
  const mk = (id: string, hour: number) => ({
    id,
    body: id,
    visibility: "public" as const,
    createdAt: new Date(`2026-09-18T${String(hour).padStart(2, "0")}:00:00.000Z`),
    authorId: "u2",
    repostOfId: null,
    username: "tega",
    displayName: "Sir T",
    avatarKey: null,
  });
  /** decorate() reads media, likes, comments, reposts, liked, reposted, saved and gifts. */
  const decorated = () => [[], [], [], [], [], [], [], []];

  it("Following reads newest first: the viewer's own posts and everyone they follow, nobody blocked", async () => {
    const wheres: SQL[] = [];
    const svc = new PostsService(
      makeRecordingDb(wheres) as never,
      makeStorage() as never,
      push as never,
    );
    await svc.feed("viewer-1", { tab: "following", cursor: "2026-09-18T09:00:00.000Z" });
    const { sql, params } = new PgDialect().sqlToQuery(wheres[0]);
    // The one visibility rule, then the cursor, then who the viewer follows.
    expect(sql).toContain('"post"."visibility" = $1 or "post"."author_id" = $2');
    expect(sql.replace(/\$[0-9]+/g, "?")).toContain('"post"."created_at" < ?');
    expect(sql.replace(/\$[0-9]+/g, "?")).toContain(
      '"post"."author_id" = ? or exists (select 1 from "follow" where "follow"."follower_id" = ? and "follow"."following_id" = "post"."author_id")',
    );
    expect(sql).toContain('"member_block"');
    expect(params).toEqual(expect.arrayContaining(["2026-09-18T09:00:00.000Z", "viewer-1"]));
    expect(rankedTabPage).not.toHaveBeenCalled();
  });

  it("an empty Following says the viewer follows nobody, and only then", async () => {
    const nobody = makeDb([[], []]);
    await expect(service(nobody).feed("u1", { tab: "following" })).resolves.toEqual({
      items: [],
      nextCursor: null,
      hint: "no_follows",
    });
    // They follow someone who hasn't posted: just empty.
    const quiet = makeDb([[], [{ id: "u2" }]]);
    await expect(service(quiet).feed("u1", { tab: "following" })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    // A page with posts on it never asks.
    const busy = makeDb([[mk("p1", 9)], ...decorated()]);
    const page = await service(busy).feed("u1", { tab: "following" });
    expect(page.hint).toBeUndefined();
    // The page itself, the eight counts beside its posts, and who they tag.
    expect(busy.select).toHaveBeenCalledTimes(10);
  });

  it("For You shows the rows the ranking chose, in its order, read through the visibility rule", async () => {
    vi.mocked(rankedTabPage).mockResolvedValueOnce({
      ids: ["p2", "gone", "p1"],
      nextCursor: "next",
    });
    const wheres: SQL[] = [];
    // selectPosts answers newest first, and without "gone", which the viewer can no longer see.
    const db = makeDb([[mk("p2", 8), mk("p1", 10)], ...decorated()]);
    const recorded = { ...db, select: vi.fn(() => recordWhere(db.select(), wheres)) };

    const page = await service(recorded as never).feed("viewer-1", {
      tab: "for_you",
      cursor: "opaque",
      limit: 3,
    });

    expect(rankedTabPage).toHaveBeenCalledWith(recorded, "viewer-1", "for_you", "opaque", 3);
    expect(page.items.map((i) => i.id)).toEqual(["p2", "p1"]);
    expect(page.nextCursor).toBe("next");
    const { sql, params } = new PgDialect().sqlToQuery(wheres[0]);
    expect(sql).toContain('"post"."visibility" = $1 or "post"."author_id" = $2');
    expect(sql.replace(/\$[0-9]+/g, "?")).toContain('"post"."id" in (?, ?, ?)');
    expect(params.slice(-3)).toEqual(["p2", "gone", "p1"]);
  });

  it("opens For You with the viewer's country's organizations' posts from the last 48 hours", async () => {
    vi.mocked(rankedTabPage).mockResolvedValueOnce({ ids: ["p2", "org1"], nextCursor: "next" });
    const wheres: SQL[] = [];
    const db = makeDb([
      [mk("p2", 8), mk("org1", 7)], // the ranked page
      [], // no organization speaks to every country
      [{ country: "NG" }], // the viewer's country
      [mk("org1", 7)], // its organizations' pins
      ...decorated(),
    ]);
    const recorded = { ...db, select: vi.fn(() => recordWhere(db.select(), wheres)) };

    const page = await service(recorded as never).feed("viewer-1", { tab: "for_you" });

    // Pinned first, and not shown again where the ranking put it.
    expect(page.items.map((i) => i.id)).toEqual(["org1", "p2"]);
    const everywhere = new PgDialect().sqlToQuery(wheres[1]);
    expect(everywhere.sql).toContain('"org_profile"."country" is null');
    const local = new PgDialect().sqlToQuery(wheres[3]);
    expect(local.sql).toContain(`"org_profile"."account_type" = 'organization'`);
    expect(local.sql).toContain('"org_profile"."country" =');
    expect(local.sql).toContain("interval '1 hour'");
    expect(local.sql).toContain('"member_block"');
    expect(local.params).toEqual(expect.arrayContaining([48, "public", "viewer-1", "NG"]));
  });

  it("puts the organizations that speak to every country first, then the viewer's country's", async () => {
    vi.mocked(rankedTabPage).mockResolvedValueOnce({ ids: ["p2"], nextCursor: null });
    const db = makeDb([
      [mk("p2", 8)],
      [mk("kinkord", 9)], // every country
      [{ country: "KE" }],
      [mk("ke1", 6)], // Kenya's
      ...decorated(),
    ]);
    const page = await service(db).feed("viewer-1", { tab: "for_you" });
    expect(page.items.map((i) => i.id)).toEqual(["kinkord", "ke1", "p2"]);
  });

  it("asks nothing more once every-country posts fill the pins", async () => {
    vi.mocked(rankedTabPage).mockResolvedValueOnce({ ids: [], nextCursor: null });
    const db = makeDb([[mk("k1", 9), mk("k2", 8), mk("k3", 7)], ...decorated()]);
    const page = await service(db).feed("viewer-1", { tab: "for_you" });
    expect(page.items.map((i) => i.id)).toEqual(["k1", "k2", "k3"]);
    // The pins, then the page's own reads: never the viewer's country.
    expect(db.select).toHaveBeenCalledTimes(1 + 8 + 1);
  });

  it("pins nothing past the first page; a viewer with no country still gets every-country posts", async () => {
    vi.mocked(rankedTabPage).mockResolvedValueOnce({ ids: [], nextCursor: null });
    const later = makeDb();
    await service(later).feed("viewer-1", { tab: "for_you", cursor: "opaque" });
    expect(later.select).not.toHaveBeenCalled();

    vi.mocked(rankedTabPage).mockResolvedValueOnce({ ids: [], nextCursor: null });
    const nowhere = makeDb([[mk("k1", 9)], [{ country: null }], ...decorated()]);
    await expect(service(nowhere).feed("viewer-1", { tab: "for_you" })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: "k1" })],
    });
  });

  it("Nearby says when the viewer has no location, reading no posts", async () => {
    vi.mocked(rankedTabPage).mockResolvedValueOnce({
      ids: [],
      nextCursor: null,
      hint: "no_location",
    });
    const db = makeDb();
    await expect(service(db).feed("u1", { tab: "nearby" })).resolves.toEqual({
      items: [],
      nextCursor: null,
      hint: "no_location",
    });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("a profile's Posts tab and a search read newest first, whatever the tab", async () => {
    const wheres: SQL[] = [];
    const svc = new PostsService(
      makeRecordingDb(wheres) as never,
      makeStorage() as never,
      push as never,
    );
    vi.spyOn(svc as never, "resolveAuthor").mockResolvedValue("u2" as never);
    await svc.feed("viewer-1", { tab: "following", author: "tega" });
    await svc.feed("viewer-1", { tab: "for_you", q: "brunch" });
    expect(rankedTabPage).not.toHaveBeenCalled();
    for (const where of wheres) {
      expect(new PgDialect().sqlToQuery(where).sql).not.toContain('"follow"."follower_id"');
    }
  });

  it("is the feed as it always was without a tab", async () => {
    await service(makeDb([[]])).feed("u1");
    expect(rankedTabPage).not.toHaveBeenCalled();
  });
});

describe("post counts and post media carry the same rule", () => {
  const renderWheres = async (run: (svc: PostsService) => Promise<unknown>) => {
    const wheres: SQL[] = [];
    const svc = new PostsService(
      makeRecordingDb(wheres) as never,
      makeStorage() as never,
      push as never,
    );
    await run(svc);
    return wheres.map((w) => new PgDialect().sqlToQuery(w));
  };

  it("counts only the posts the viewer is allowed to see", async () => {
    const [q] = await renderWheres((svc) => svc.postCountsFor(["u2", "u3"], "viewer-1"));

    expect(q.sql).toContain('"post"."deleted_at" is null');
    expect(q.sql).toContain('"post"."author_id" in ($1, $2)');
    expect(q.sql).toContain('from "friendship"');
    expect(q.sql).toContain("'accepted'");
    expect(q.params).toEqual(
      expect.arrayContaining(["u2", "u3", "public", "viewer-1", "friends", "viewer-1", "viewer-1"]),
    );
  });

  it("does not query at all for an empty set of members", async () => {
    const wheres: SQL[] = [];
    const db = makeRecordingDb(wheres);
    const svc = new PostsService(db as never, makeStorage() as never, push as never);
    await expect(svc.postCountsFor([], "viewer-1")).resolves.toEqual(new Map());
    expect(db.select).not.toHaveBeenCalled();
  });

  it("shows a member's post photos only from posts the viewer may read", async () => {
    const [q] = await renderWheres((svc) => svc.postMediaFor("u2", "viewer-1", ["image"], 20, 0));

    expect(q.sql).toContain('"post"."author_id" = $1');
    expect(q.sql).toContain('"post_media"."kind" in ($2)');
    expect(q.sql).toContain('from "friendship"');
    expect(q.params.slice(0, 2)).toEqual(["u2", "image"]);
  });

  it("asks for nothing when the pill covers no post attachment", async () => {
    const wheres: SQL[] = [];
    const db = makeRecordingDb(wheres);
    const svc = new PostsService(db as never, makeStorage() as never, push as never);
    await expect(svc.postMediaFor("u2", "viewer-1", [], 20, 0)).resolves.toEqual({
      rows: [],
      total: 0,
    });
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe("PostsService.repost", () => {
  const publicVm = { postId: "p1", visibility: "public", author: { userId: "u2" } };

  /** `repost` resolves its target through `byId`, which is stubbed here. */
  const withTarget = (vm: unknown, results: unknown[][] = []) => {
    const svc = service(makeDb(results), makeStorage());
    vi.spyOn(svc, "byId").mockResolvedValue(vm as never);
    return svc;
  };

  it("refuses to lift a friends-only post into a stranger's feed", async () => {
    const svc = withTarget({ ...publicVm, visibility: "friends" });
    await expect(svc.repost("p1", "u1")).rejects.toThrow(/cannot be reposted/);
  });

  it("is a 404 for a post the viewer cannot see", async () => {
    const svc = withTarget(null);
    await expect(svc.repost("p1", "u1")).rejects.toThrow(/not found/i);
  });

  it("points a repost of a repost at the original, so no chain forms", async () => {
    // byId on a repost answers with the original's postId.
    const db = makeDb([[], [{ n: 1 }], [{ id: "r2" }]]);
    const svc = service(db, makeStorage());
    vi.spyOn(svc, "byId").mockResolvedValue({
      ...publicVm,
      id: "r1",
      postId: "p1",
    } as never);

    const result = await svc.repost("r1", "u1");

    const values = db.insert.mock.results[0];
    expect(values).toBeDefined();
    expect(result).toEqual({ postId: "p1", reposts: 1, repostedByMe: true });
  });

  it("answers with the fresh count after an un-repost", async () => {
    const db = makeDb([[], [{ n: 0 }], []]);
    const svc = service(db, makeStorage());
    vi.spyOn(svc, "byId").mockResolvedValue(publicVm as never);

    await expect(svc.unrepost("p1", "u1")).resolves.toEqual({
      postId: "p1",
      reposts: 0,
      repostedByMe: false,
    });
    expect(db.update).toHaveBeenCalled();
  });
});

describe("PostsService.savedFeed", () => {
  it("is empty rather than an error when nothing is saved", async () => {
    await expect(service(makeDb([[]])).savedFeed("u1")).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("keeps the order the posts were saved in, newest save first", async () => {
    const mk = (id: string) => ({
      id,
      body: id,
      visibility: "public" as const,
      createdAt: new Date("2026-09-18T09:00:00.000Z"),
      authorId: "u2",
      repostOfId: null,
      username: "tega",
      displayName: "Sir T",
      avatarKey: null,
    });
    const db = makeDb([
      [
        { postId: "p2", createdAt: new Date("2026-09-18T12:00:00.000Z") },
        { postId: "p1", createdAt: new Date("2026-09-18T11:00:00.000Z") },
      ],
      // selectPosts answers newest-post-first, which is not the save order.
      [mk("p1"), mk("p2")],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ]);

    const page = await service(db).savedFeed("u1");

    expect(page.items.map((i) => i.id)).toEqual(["p2", "p1"]);
    expect(page.nextCursor).toBeNull();
  });

  it("silently drops a saved post that is no longer visible", async () => {
    const db = makeDb([
      [{ postId: "p1", createdAt: new Date("2026-09-18T12:00:00.000Z") }],
      // The feed query returns nothing for it: deleted, or the friendship ended.
      [],
    ]);
    await expect(service(db).savedFeed("u1")).resolves.toEqual({ items: [], nextCursor: null });
  });
});

describe("repost notifications", () => {
  it("notifies the original author only when a repost is actually inserted", async () => {
    push.newRepost.mockClear();
    const db = makeDb([[{ id: "r2" }], [{ n: 1 }], [{ id: "r2" }], [], [{ n: 1 }], [{ id: "r2" }]]);
    const svc = service(db);
    vi.spyOn(svc, "byId").mockResolvedValue({
      postId: "p1",
      visibility: "public",
      author: { userId: "u2" },
    } as never);
    await svc.repost("r1", "u1");
    await svc.repost("r1", "u1");
    expect(push.newRepost).toHaveBeenCalledTimes(1);
    expect(push.newRepost).toHaveBeenCalledWith("p1", "u2", "u1");
  });
});

describe("share counts", () => {
  const withTx = (db: ReturnType<typeof makeDb>) =>
    Object.assign(db, { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)) });
  it("counts a member's first share of the original post, after visibility is checked", async () => {
    const db = withTx(makeDb([[{ postId: "original" }], [{ shares: 4 }]]));
    const svc = service(db);
    vi.spyOn(svc, "byId").mockResolvedValue({ postId: "original" } as never);
    expect(await svc.share("repost", "viewer")).toEqual({ postId: "original", shares: 4 });
    expect(svc.byId).toHaveBeenCalledWith("repost", "viewer");
    expect(db.insert).toHaveBeenCalledOnce();
    expect(db.update).toHaveBeenCalledOnce();
  });
  it("doesn't count the same member sharing it again", async () => {
    const db = withTx(makeDb([[], [{ shares: 4 }]]));
    const svc = service(db);
    vi.spyOn(svc, "byId").mockResolvedValue({ postId: "original" } as never);
    expect(await svc.share("original", "viewer")).toEqual({ postId: "original", shares: 4 });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("does not count shares of inaccessible posts", async () => {
    const db = makeDb();
    const svc = service(db);
    vi.spyOn(svc, "byId").mockResolvedValue(null);
    await expect(svc.share("private", "viewer")).rejects.toThrow("Post not found");
    expect(db.update).not.toHaveBeenCalled();
  });
});
