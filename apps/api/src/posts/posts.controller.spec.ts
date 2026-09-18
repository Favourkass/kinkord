import { describe, expect, it, vi } from "vitest";
import { PostsController } from "./posts.controller";

const req = (id: string) => ({ user: { id } }) as never;
const ID = "0f1c8b1e-1111-4111-8111-111111111111";

const postsService = () => ({
  feed: vi.fn(async () => ({ items: [], nextCursor: null })),
  create: vi.fn(async () => ({ id: ID })),
  byId: vi.fn(async () => ({ id: ID })),
  remove: vi.fn(async () => ({ deleted: ID })),
  presignMediaUpload: vi.fn(async () => ({ key: `posts/u1/${ID}.jpg` })),
});

const interactions = () => ({
  like: vi.fn(async () => ({ postId: ID, likes: 1, likedByMe: true })),
  unlike: vi.fn(async () => ({ postId: ID, likes: 0, likedByMe: false })),
  comments: vi.fn(async () => ({ items: [], total: 0, nextCursor: null })),
  comment: vi.fn(async () => ({ id: ID })),
  removeComment: vi.fn(async () => ({ deleted: ID })),
});

const controller = (posts = postsService(), inter = interactions()) =>
  new PostsController(posts as never, inter as never);

describe("PostsController", () => {
  it("reads the feed as the caller, never as an id from the query", async () => {
    const posts = postsService();
    await controller(posts).feed(req("u1"), { author: "tega", limit: "5" });

    expect(posts.feed).toHaveBeenCalledWith("u1", {
      cursor: undefined,
      limit: 5,
      author: "tega",
    });
  });

  it("refuses a page size past the cap rather than trimming it silently", () => {
    expect(() => controller().feed(req("u1"), { limit: "500" })).toThrow();
  });

  it("writes the post as the caller, whatever the body claims", async () => {
    const posts = postsService();
    await controller(posts).create(req("u1"), {
      body: "hello",
      authorId: "someone-else",
      media: [],
    });

    expect(posts.create).toHaveBeenCalledWith("u1", {
      body: "hello",
      visibility: "public",
      media: [],
    });
  });

  it("rejects a post with neither words nor photos", () => {
    expect(() => controller().create(req("u1"), { body: "  " })).toThrow();
  });

  it("rejects an id that is not a post id", async () => {
    await expect(controller().byId(req("u1"), "../../etc/passwd")).rejects.toThrow(/invalid id/);
    expect(() => controller().remove(req("u1"), "1")).toThrow(/invalid id/);
  });

  it("is a 404 when the post is not visible to the caller", async () => {
    const posts = postsService();
    posts.byId.mockResolvedValueOnce(null as never);
    await expect(controller(posts).byId(req("u1"), ID)).rejects.toThrow(/not found/i);
  });

  it("likes and unlikes as the caller", async () => {
    const inter = interactions();
    await controller(postsService(), inter).like(req("u1"), ID);
    await controller(postsService(), inter).unlike(req("u1"), ID);

    expect(inter.like).toHaveBeenCalledWith(ID, "u1");
    expect(inter.unlike).toHaveBeenCalledWith(ID, "u1");
  });

  it("trims a comment before it reaches the service", async () => {
    const inter = interactions();
    await controller(postsService(), inter).comment(req("u1"), ID, { body: "  nice  " });
    expect(inter.comment).toHaveBeenCalledWith(ID, "u1", "nice");
  });

  it("rejects an empty comment", () => {
    expect(() => controller().comment(req("u1"), ID, { body: "   " })).toThrow();
  });

  it("presigns an upload for the caller's own prefix", async () => {
    const posts = postsService();
    await controller(posts).presignUpload(req("u1"), {
      contentType: "image/jpeg",
      contentLength: 1024,
    });
    expect(posts.presignMediaUpload).toHaveBeenCalledWith("u1", "image/jpeg", 1024);
  });
});
