import { describe, expect, it, vi } from "vitest";
import { PostsController } from "./posts.controller";

const req = (id: string) => ({ user: { id } }) as never;
const ID = "0f1c8b1e-1111-4111-8111-111111111111";

const postsService = () => ({
  feed: vi.fn(async () => ({ items: [], nextCursor: null })),
  shareToFeed: vi.fn(),
  create: vi.fn(async () => ({ id: ID })),
  byId: vi.fn(async () => ({ id: ID })),
  pinToProfile: vi.fn(async () => ({ postId: ID, pinned: true })),
  unpinFromProfile: vi.fn(async () => ({ postId: ID, pinned: false })),
  remove: vi.fn(async () => ({ deleted: ID })),
  presignMediaUpload: vi.fn(async () => ({ key: `posts/u1/${ID}.jpg` })),
  repost: vi.fn(async () => ({ postId: ID, reposts: 1, repostedByMe: true })),
  unrepost: vi.fn(async () => ({ postId: ID, reposts: 0, repostedByMe: false })),
  savedFeed: vi.fn(async () => ({ items: [], nextCursor: null })),
  removeTag: vi.fn(async () => ({ removed: true })),
  tagSuggestions: vi.fn(async () => ({ items: [] })),
  shareFriends: vi.fn(async () => []),
});

const interactions = () => ({
  like: vi.fn(async () => ({ postId: ID, likes: 1, likedByMe: true })),
  unlike: vi.fn(async () => ({ postId: ID, likes: 0, likedByMe: false })),
  comments: vi.fn(async () => ({ items: [], total: 0, nextCursor: null })),
  comment: vi.fn(async () => ({ id: ID })),
  removeComment: vi.fn(async () => ({ deleted: ID })),
  save: vi.fn(async () => ({ postId: ID, savedByMe: true })),
  unsave: vi.fn(async () => ({ postId: ID, savedByMe: false })),
});

const feedback = () => ({
  seen: vi.fn(async () => ({ seen: 1 })),
  notInterested: vi.fn(async () => ({ postId: ID })),
  undoNotInterested: vi.fn(async () => ({ postId: ID })),
});

const controller = (posts = postsService(), inter = interactions(), fb = feedback()) =>
  new PostsController(posts as never, inter as never, fb as never);

describe("PostsController", () => {
  it("pins and unpins only as the authenticated member and rejects bad ids", async () => {
    const posts = postsService();
    await controller(posts).pin(req("self"), ID);
    await controller(posts).unpin(req("self"), ID);
    expect(posts.pinToProfile).toHaveBeenCalledWith("self", ID);
    expect(posts.unpinFromProfile).toHaveBeenCalledWith("self", ID);
    expect(() => controller(posts).pin(req("self"), "bad")).toThrow();
  });
  it("reads the feed as the caller, never as an id from the query", async () => {
    const posts = postsService();
    await controller(posts).feed(req("u1"), { author: "tega", limit: "5" });

    expect(posts.feed).toHaveBeenCalledWith("u1", {
      cursor: undefined,
      limit: 5,
      author: "tega",
      q: undefined,
      tab: undefined,
    });
  });

  it("passes the home feed's tab and its opaque cursor through", async () => {
    const posts = postsService();
    await controller(posts).feed(req("u1"), { tab: "nearby", cursor: "eyJ2IjoxfQ" });
    expect(posts.feed).toHaveBeenCalledWith("u1", {
      cursor: "eyJ2IjoxfQ",
      limit: undefined,
      author: undefined,
      q: undefined,
      tab: "nearby",
    });
  });

  it("refuses a tab the feed doesn't have", () => {
    expect(() => controller().feed(req("u1"), { tab: "trending" })).toThrow();
  });

  it("passes a search term to the feed, and drops an empty one", async () => {
    const posts = postsService();
    await controller(posts).feed(req("u1"), { q: "  brunch " });
    expect(posts.feed).toHaveBeenLastCalledWith("u1", {
      cursor: undefined,
      limit: undefined,
      author: undefined,
      q: "brunch",
      tab: undefined,
    });
    await controller(posts).feed(req("u1"), { q: "   " });
    expect(posts.feed).toHaveBeenLastCalledWith("u1", {
      cursor: undefined,
      limit: undefined,
      author: undefined,
      q: undefined,
      tab: undefined,
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
      tags: [],
    });
  });

  it("takes tags as usernames, ten at most", () => {
    const posts = postsService();
    void controller(posts).create(req("u1"), { body: "hi", tags: ["@ada", "kemi_9"] });
    expect(posts.create).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ tags: ["@ada", "kemi_9"] }),
    );
    expect(() => controller().create(req("u1"), { body: "hi", tags: ["not a name"] })).toThrow();
    const eleven = Array.from({ length: 11 }, (_, i) => `friend_${i}`);
    expect(() => controller().create(req("u1"), { body: "hi", tags: eleven })).toThrow();
  });

  it("lets the tagged member take their tag off, and suggests friends to tag", async () => {
    const posts = postsService();
    await controller(posts).removeTag(req("u2"), ID);
    expect(posts.removeTag).toHaveBeenCalledWith("u2", ID);
    expect(() => controller(posts).removeTag(req("u2"), "not-an-id")).toThrow();
    await controller(posts).tagSuggestions(req("u1"), "ad");
    await controller(posts).tagSuggestions(req("u1"), undefined);
    expect(posts.tagSuggestions.mock.calls).toEqual([
      ["u1", "ad"],
      ["u1", ""],
    ]);
  });

  it("suggests friends to send a post to", async () => {
    const posts = postsService();
    await controller(posts).shareFriends(req("u1"), "sa");
    await controller(posts).shareFriends(req("u1"), undefined);
    expect(posts.shareFriends.mock.calls).toEqual([
      ["u1", "sa"],
      ["u1", ""],
    ]);
  });

  it("reads a profile's Tagged tab from the feed", async () => {
    const posts = postsService();
    await controller(posts).feed(req("u1"), { tagged: "ada" });
    expect(posts.feed).toHaveBeenCalledWith("u1", expect.objectContaining({ tagged: "ada" }));
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

  it("reposts and un-reposts as the caller", async () => {
    const inter = interactions();
    const p = postsService();
    await controller(p, inter).repost(req("u1"), ID);
    await controller(p, inter).unrepost(req("u1"), ID);

    expect(p.repost).toHaveBeenCalledWith(ID, "u1");
    expect(p.unrepost).toHaveBeenCalledWith(ID, "u1");
  });

  it("takes the posts the feed showed as the caller, 50 at most and only post ids", async () => {
    const fb = feedback();
    await controller(undefined, undefined, fb).seen(req("u1"), { ids: [ID] });
    expect(fb.seen).toHaveBeenCalledWith("u1", [ID]);
    const c = controller(undefined, undefined, fb);
    expect(() => c.seen(req("u1"), { ids: [] })).toThrow();
    expect(() => c.seen(req("u1"), { ids: ["nope"] })).toThrow();
    expect(() => c.seen(req("u1"), { ids: Array.from({ length: 51 }, () => ID) })).toThrow();
    expect(() => c.seen(req("u1"), { ids: [ID], userId: "u2" })).toThrow();
  });

  it("marks a post not interested, and undoes it, as the caller", async () => {
    const fb = feedback();
    await controller(undefined, undefined, fb).notInterested(req("u1"), ID);
    await controller(undefined, undefined, fb).undoNotInterested(req("u1"), ID);
    expect(fb.notInterested).toHaveBeenCalledWith("u1", ID);
    expect(fb.undoNotInterested).toHaveBeenCalledWith("u1", ID);
    expect(() => controller().notInterested(req("u1"), "nope")).toThrow();
  });

  it("saves and unsaves as the caller", async () => {
    const inter = interactions();
    await controller(postsService(), inter).save(req("u1"), ID);
    await controller(postsService(), inter).unsave(req("u1"), ID);

    expect(inter.save).toHaveBeenCalledWith(ID, "u1");
    expect(inter.unsave).toHaveBeenCalledWith(ID, "u1");
  });

  it('reads the saved list as the caller — "saved" is a route, not a post id', async () => {
    const p = postsService();
    await controller(p).saved(req("u1"), { limit: "5" });

    expect(p.savedFeed).toHaveBeenCalledWith("u1", { cursor: undefined, limit: 5 });
    expect(p.byId).not.toHaveBeenCalled();
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

it("validates caption length and binds feed shares to the signed-in member", async () => {
  const posts = postsService();
  await controller(posts).shareToFeed(req("self"), ID, { caption: "  Hello  ", userId: "other" });
  expect(posts.shareToFeed).toHaveBeenCalledWith(ID, "self", "Hello");
  expect(() =>
    controller(posts).shareToFeed(req("self"), ID, { caption: "x".repeat(2001) }),
  ).toThrow();
  expect(() => controller(posts).shareToFeed(req("self"), "bad", {})).toThrow();
});
