import { describe, expect, it, vi } from "vitest";
import { createCommentSchema, PostInteractionsService } from "./post-interactions.service";

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

const storage = () => ({ presignDownload: vi.fn(async (k: string) => `https://s3.test/${k}`) });

/** `byId` applies the feed's visibility rules; null means "not for this viewer". */
const posts = (author: string | null = "u2", postId = "p1") => ({
  byId: vi.fn(async () => (author ? { postId, author: { userId: author } } : null)),
});

const service = (db = makeDb(), p = posts()) =>
  new PostInteractionsService(db as never, p as never, storage() as never);

describe("createCommentSchema", () => {
  it("refuses whitespace", () => {
    expect(createCommentSchema.safeParse({ body: "   " }).success).toBe(false);
  });

  it("refuses an essay", () => {
    expect(createCommentSchema.safeParse({ body: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("visibility", () => {
  it("will not let a stranger like a post they cannot read", async () => {
    await expect(service(makeDb(), posts(null)).like("p1", "u1")).rejects.toThrow(/not found/i);
  });

  it("will not let a stranger comment on a post they cannot read", async () => {
    await expect(service(makeDb(), posts(null)).comment("p1", "u1", "hi")).rejects.toThrow(
      /not found/i,
    );
  });

  it("will not list comments on a post they cannot read", async () => {
    await expect(service(makeDb(), posts(null)).comments("p1", "u1")).rejects.toThrow(/not found/i);
  });
});

describe("PostInteractionsService.like", () => {
  it("is idempotent — a double tap leaves one row", async () => {
    const db = makeDb([[], [{ total: 1 }], [{ postId: "p1" }]]);
    const result = await service(db).like("p1", "u1");
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ postId: "p1", likes: 1, likedByMe: true });
  });

  it("answers with the fresh count after an unlike", async () => {
    const db = makeDb([[], [{ total: 0 }], []]);
    await expect(service(db).unlike("p1", "u1")).resolves.toEqual({
      postId: "p1",
      likes: 0,
      likedByMe: false,
    });
  });
});

describe("PostInteractionsService.comments", () => {
  const row = (id: string, authorId: string, at: string) => ({
    id,
    body: `comment ${id}`,
    createdAt: new Date(at),
    authorId,
    username: "tega",
    displayName: "Sir T",
    avatarKey: null,
  });

  it("lets the post's author remove anyone's comment on it", async () => {
    // Viewer u2 owns the post (posts() reports author u2) but wrote neither comment.
    const db = makeDb([[row("c1", "u9", "2026-09-18T09:00:00.000Z")], [{ total: 1 }]]);
    const result = await service(db).comments("p1", "u2");
    expect(result.items[0].canDelete).toBe(true);
  });

  it("does not offer delete on someone else's comment under someone else's post", async () => {
    const db = makeDb([[row("c1", "u9", "2026-09-18T09:00:00.000Z")], [{ total: 1 }]]);
    const result = await service(db).comments("p1", "u1");
    expect(result.items[0].canDelete).toBe(false);
  });

  it("hands back a cursor only when there is another page", async () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      row(`c${i}`, "u9", `2026-09-18T09:${String(i).padStart(2, "0")}:00.000Z`),
    );
    const db = makeDb([rows, [{ total: 11 }]]);
    const result = await service(db).comments("p1", "u1", null, 10);
    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBe("2026-09-18T09:09:00.000Z");
  });

  it("has no cursor on the last page", async () => {
    const db = makeDb([[row("c1", "u9", "2026-09-18T09:00:00.000Z")], [{ total: 1 }]]);
    const result = await service(db).comments("p1", "u1", null, 10);
    expect(result.nextCursor).toBeNull();
  });
});

describe("PostInteractionsService.removeComment", () => {
  it("lets the comment's author delete it", async () => {
    const db = makeDb([[{ commentAuthorId: "u1", postAuthorId: "u9", deletedAt: null }]]);
    await expect(service(db).removeComment("c1", "u1")).resolves.toEqual({ deleted: "c1" });
  });

  it("lets the post's author moderate their own thread", async () => {
    const db = makeDb([[{ commentAuthorId: "u9", postAuthorId: "u1", deletedAt: null }]]);
    await expect(service(db).removeComment("c1", "u1")).resolves.toEqual({ deleted: "c1" });
  });

  it("refuses anyone else", async () => {
    const db = makeDb([[{ commentAuthorId: "u9", postAuthorId: "u8", deletedAt: null }]]);
    await expect(service(db).removeComment("c1", "u1")).rejects.toThrow(/isn't your comment/);
  });

  it("is a 404 for a comment that is already gone", async () => {
    const db = makeDb([[{ commentAuthorId: "u1", postAuthorId: "u1", deletedAt: new Date() }]]);
    await expect(service(db).removeComment("c1", "u1")).rejects.toThrow(/not found/i);
  });
});

describe("PostInteractionsService saves", () => {
  it("is idempotent — saving twice leaves one row", async () => {
    const db = makeDb();
    await expect(service(db).save("p1", "u1")).resolves.toEqual({
      postId: "p1",
      savedByMe: true,
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("saves the post itself, not somebody's repost of it", async () => {
    // Otherwise the save would vanish the moment that repost was undone.
    const db = makeDb();
    await expect(service(db, posts("u2", "p1")).save("r1", "u1")).resolves.toMatchObject({
      postId: "p1",
    });
  });

  it("unsaves", async () => {
    const db = makeDb();
    await expect(service(db).unsave("p1", "u1")).resolves.toEqual({
      postId: "p1",
      savedByMe: false,
    });
    expect(db.delete).toHaveBeenCalled();
  });

  it("will not let a stranger save a post they cannot read", async () => {
    await expect(service(makeDb(), posts(null)).save("p1", "u1")).rejects.toThrow(/not found/i);
  });
});
