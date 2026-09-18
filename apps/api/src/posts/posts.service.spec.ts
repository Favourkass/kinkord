import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { clamp, createPostSchema, parseCursor, PostsService } from "./posts.service";

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

const service = (db = makeDb(), storage = makeStorage()) =>
  new PostsService(db as never, storage as never);

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

describe("PostsService.create", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
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
  ];

  it("carries the counts, the viewer's own reactions, and a small avatar", async () => {
    const storage = makeStorage();
    const db = makeDb([
      [row],
      ...decorated({
        media: [{ id: "m1", postId: "p1", kind: "image", key: "posts/u2/a.jpg", position: 0 }],
        likes: [{ postId: "p1", n: 3 }],
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
      comments: 2,
      reposts: 9,
      likedByMe: true,
      repostedByMe: true,
      savedByMe: true,
      repostedBy: null,
      mine: false,
      author: { username: "tega", displayName: "Sir T" },
    });
    expect(vm?.media[0].thumbUrl).toContain("v=md");
    expect(storage.presignDownload).toHaveBeenCalledWith("avatars/u2/a.jpg", "sm");
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
    const svc = new PostsService(makeRecordingDb(wheres) as never, makeStorage() as never);
    await svc.feed("viewer-1", params);
    return new PgDialect().sqlToQuery(wheres[0]);
  };

  it("shows public posts, the viewer's own, and friends-only posts only between mutual follows", async () => {
    const { sql, params } = await feedSql();

    expect(sql).toContain('"post"."deleted_at" is null');
    expect(sql).toContain('"post"."visibility" = $1 or "post"."author_id" = $2');
    // Both directions of the follow must be present — one alone is not friendship.
    expect(sql).toContain('"viewer_follows_author"."follower_id" is not null');
    expect(sql).toContain('"author_follows_viewer"."follower_id" is not null');
    expect(params.slice(0, 3)).toEqual(["public", "viewer-1", "friends"]);
  });

  it("narrows a profile's Posts tab to that member's own rows", async () => {
    // A member's Posts tab must show what they wrote and what they reposted —
    // never a post of somebody else's that they only liked or commented on.
    // A repost row carries the reposter as its author, so one filter covers both.
    const wheres: SQL[] = [];
    const svc = new PostsService(makeRecordingDb(wheres) as never, makeStorage() as never);
    vi.spyOn(svc as never, "resolveAuthor").mockResolvedValue("u2" as never);

    await svc.feed("viewer-1", { author: "tega" });
    const { sql, params } = new PgDialect().sqlToQuery(wheres[0]);

    expect(sql).toContain('"post"."author_id" = $4');
    expect(params[3]).toBe("u2");
  });

  it("pages by timestamp so a post arriving mid-scroll cannot shift the page", async () => {
    const { sql, params } = await feedSql({ cursor: "2026-09-18T09:00:00.000Z" });
    expect(sql).toContain('"post"."created_at" < $4');
    expect(params[3]).toBe("2026-09-18T09:00:00.000Z");
  });

  it("leaves the cursor out of the query on the first page", async () => {
    const { sql } = await feedSql();
    expect(sql).not.toContain('"post"."created_at" <');
  });
});

describe("post counts and post media carry the same rule", () => {
  const renderWheres = async (run: (svc: PostsService) => Promise<unknown>) => {
    const wheres: SQL[] = [];
    const svc = new PostsService(makeRecordingDb(wheres) as never, makeStorage() as never);
    await run(svc);
    return wheres.map((w) => new PgDialect().sqlToQuery(w));
  };

  it("counts only the posts the viewer is allowed to see", async () => {
    const [q] = await renderWheres((svc) => svc.postCountsFor(["u2", "u3"], "viewer-1"));

    expect(q.sql).toContain('"post"."deleted_at" is null');
    expect(q.sql).toContain('"post"."author_id" in ($1, $2)');
    expect(q.sql).toContain('"viewer_follows_author"."follower_id" is not null');
    expect(q.sql).toContain('"author_follows_viewer"."follower_id" is not null');
    expect(q.params).toEqual(["u2", "u3", "public", "viewer-1", "friends"]);
  });

  it("does not query at all for an empty set of members", async () => {
    const wheres: SQL[] = [];
    const db = makeRecordingDb(wheres);
    const svc = new PostsService(db as never, makeStorage() as never);
    await expect(svc.postCountsFor([], "viewer-1")).resolves.toEqual(new Map());
    expect(db.select).not.toHaveBeenCalled();
  });

  it("shows a member's post photos only from posts the viewer may read", async () => {
    const [q] = await renderWheres((svc) => svc.postMediaFor("u2", "viewer-1", ["image"], 20, 0));

    expect(q.sql).toContain('"post"."author_id" = $1');
    expect(q.sql).toContain('"post_media"."kind" in ($2)');
    expect(q.sql).toContain('"viewer_follows_author"."follower_id" is not null');
    expect(q.params.slice(0, 2)).toEqual(["u2", "image"]);
  });

  it("asks for nothing when the pill covers no post attachment", async () => {
    const wheres: SQL[] = [];
    const db = makeRecordingDb(wheres);
    const svc = new PostsService(db as never, makeStorage() as never);
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
