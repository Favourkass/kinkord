import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PostPM } from "@/domain/post";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
const upload = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    del: (...a: unknown[]) => del(...a),
  },
  uploadToPresignedUrl: (...a: unknown[]) => upload(...a),
  ApiError: class ApiError extends Error {},
}));

const buildUploadSet = vi.fn();
vi.mock("@/util/image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/util/image")>()),
  buildUploadSet: (...a: unknown[]) => buildUploadSet(...a),
}));

const {
  applyLike,
  applyToPost,
  canSubmitComment,
  canSubmitPost,
  postsApi,
  remainingPhotoSlots,
  toggleLikeOnPost,
  uploadPostPhoto,
  withAuthorFollow,
  withCommentDelta,
  withSuggestionFollow,
  withSuggestionRestored,
} = await import("./posts.service");

const pm = (over: Partial<PostPM> = {}): PostPM => ({
  id: "p1",
  postId: "p1",
  body: "hi",
  visibility: "public",
  createdAt: "2026-09-18T11:00:00.000Z",
  author: { userId: "u2", username: "tega", displayName: "Sir T", avatarUrl: null },
  media: [],
  likes: 5,
  comments: 2,
  reposts: 0,
  likedByMe: false,
  repostedByMe: false,
  savedByMe: false,
  repostedBy: null,
  mine: false,
  ...over,
});

beforeEach(() => {
  get.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  post.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
  upload.mockReset().mockResolvedValue(undefined);
});

describe("what counts as postable", () => {
  it("takes words, or photos, but not whitespace alone", () => {
    expect(canSubmitPost("  ", 0)).toBe(false);
    expect(canSubmitPost("  ", 1)).toBe(true);
    expect(canSubmitPost("hello", 0)).toBe(true);
  });

  it("refuses an empty comment and one past the cap", () => {
    expect(canSubmitComment("   ")).toBe(false);
    expect(canSubmitComment("hi")).toBe(true);
    expect(canSubmitComment("x".repeat(1001))).toBe(false);
  });

  it("counts down the photo slots", () => {
    expect(remainingPhotoSlots(0)).toBe(4);
    expect(remainingPhotoSlots(4)).toBe(0);
    expect(remainingPhotoSlots(9)).toBe(0);
  });
});

describe("optimistic like", () => {
  it("flips the state and the count, and flips back", () => {
    const liked = toggleLikeOnPost(pm());
    expect(liked).toMatchObject({ likedByMe: true, likes: 6 });
    expect(toggleLikeOnPost(liked)).toMatchObject({ likedByMe: false, likes: 5 });
  });

  it("never shows a negative count", () => {
    expect(toggleLikeOnPost(pm({ likes: 0, likedByMe: true })).likes).toBe(0);
  });

  it("lets the server's answer win over the guess", () => {
    const next = applyLike(pm({ likes: 6, likedByMe: true }), {
      postId: "p1",
      likes: 41,
      likedByMe: true,
    });
    expect(next.likes).toBe(41);
  });

  it("leaves a different post alone", () => {
    const other = pm({ id: "p2", postId: "p2", likes: 1 });
    expect(applyLike(other, { postId: "p1", likes: 99, likedByMe: true })).toBe(other);
  });

  it("updates a repost of the post too, so the two never disagree", () => {
    // A post and a repost of it can sit in the same feed; both show its count.
    const repost = pm({ id: "r1", postId: "p1", likes: 5 });
    expect(applyLike(repost, { postId: "p1", likes: 6, likedByMe: true })).toMatchObject({
      id: "r1",
      likes: 6,
      likedByMe: true,
    });
  });
});

describe("comment counts", () => {
  it("moves by one and floors at zero", () => {
    expect(withCommentDelta(pm(), 1).comments).toBe(3);
    expect(withCommentDelta(pm({ comments: 0 }), -1).comments).toBe(0);
  });

  it("applies to one post in a list", () => {
    const list = [pm(), pm({ id: "p2" })];
    const next = applyToPost(list, "p2", (p) => withCommentDelta(p, 1));
    expect(next[0].comments).toBe(2);
    expect(next[1].comments).toBe(3);
  });
});

describe("following, wherever the member shows", () => {
  it("sets the suggestion card without waiting for the round trip", () => {
    const person = {
      userId: "u2",
      username: "tega",
      displayName: "Sir T",
      avatarUrl: null,
      isFollowing: false,
    };
    const other = { ...person, userId: "u3", username: "kay" };
    const next = withSuggestionFollow([person, other], "u2", true);
    expect(next.map((s) => s.isFollowing)).toEqual([true, false]);
    expect(withSuggestionFollow(next, "u2", false)[0].isFollowing).toBe(false);
  });

  it("puts a card whose removal failed back where it was, once", () => {
    const card = (userId: string) => ({
      userId,
      username: userId,
      displayName: userId,
      avatarUrl: null,
      isFollowing: false,
    });
    const ids = (list: { userId: string }[]) => list.map((s) => s.userId);
    expect(ids(withSuggestionRestored([card("a"), card("c")], card("b"), 1))).toEqual([
      "a",
      "b",
      "c",
    ]);
    // The list got shorter meanwhile: it goes at the end.
    expect(ids(withSuggestionRestored([card("a")], card("b"), 4))).toEqual(["a", "b"]);
    const back = [card("a"), card("b")];
    expect(withSuggestionRestored(back, card("b"), 0)).toBe(back);
  });

  it("sets every post by that author, a repost of theirs included, and no one else's", () => {
    const repost = pm({
      id: "r1",
      repostedBy: { userId: "u1", username: "me", displayName: "Me" },
    });
    const someoneElse = pm({
      id: "p2",
      postId: "p2",
      author: { userId: "u3", username: "kay", displayName: "Kay", avatarUrl: null },
    });
    const next = withAuthorFollow([pm(), repost, someoneElse], "u2", true);
    expect(next.map((p) => p.author.isFollowing)).toEqual([true, true, undefined]);
  });
});

describe("postsApi", () => {
  it("asks for the first page with no cursor in the URL", async () => {
    await postsApi.feed();
    expect(get).toHaveBeenCalledWith("/posts/feed");
  });

  it("carries the cursor and page size on the next page", async () => {
    await postsApi.feed("2026-09-18T09:00:00.000Z", 5);
    expect(get).toHaveBeenCalledWith("/posts/feed?cursor=2026-09-18T09%3A00%3A00.000Z&limit=5");
  });

  it("asks for the posts that contain a search", async () => {
    await postsApi.feed(null, undefined, null, "brunch & tea");
    expect(get).toHaveBeenCalledWith("/posts/feed?q=brunch+%26+tea");
  });

  it("sends media as keys and drops an empty body rather than posting a blank", async () => {
    await postsApi.create({ body: "  ", visibility: "friends", mediaKeys: ["posts/u1/a.jpg"] });
    expect(post).toHaveBeenCalledWith("/posts", {
      body: undefined,
      visibility: "friends",
      media: [{ key: "posts/u1/a.jpg", kind: "image" }],
    });
  });

  it("escapes an id rather than pasting it into the path", async () => {
    await postsApi.like("a/b");
    expect(post).toHaveBeenCalledWith("/posts/a%2Fb/like", {});
  });

  it("asks for Kinksters Near You for a segment, or leaves the default to the API", async () => {
    await postsApi.suggested(10);
    expect(get).toHaveBeenLastCalledWith("/members/suggested?limit=10");
    await postsApi.suggested(10, "men");
    expect(get).toHaveBeenLastCalledWith("/members/suggested?limit=10&show=men");
  });

  it("removes a suggestion by member id", async () => {
    await postsApi.dismissSuggestion("u/2");
    expect(post).toHaveBeenCalledWith("/members/suggested/u%2F2/dismiss", {});
  });
});

describe("uploadPostPhoto", () => {
  it("uploads every stored size before the original, then returns the key", async () => {
    const file = { type: "image/jpeg", size: 2048 } as File;
    buildUploadSet.mockResolvedValue({
      original: file,
      variants: { sm: file, md: file },
    });
    post.mockResolvedValue({
      key: "posts/u1/abc.jpg",
      uploadUrl: "put-original",
      variantUploadUrls: { sm: "put-sm", md: "put-md" },
    });

    await expect(uploadPostPhoto(file)).resolves.toBe("posts/u1/abc.jpg");

    expect(buildUploadSet).toHaveBeenCalledWith(file, "post");
    expect(post).toHaveBeenCalledWith("/posts/upload-url", {
      contentType: "image/jpeg",
      contentLength: 2048,
    });
    // The original lands last, so a post never names a key whose sizes are missing.
    expect(upload.mock.calls.map((c) => c[0])).toEqual(["put-sm", "put-md", "put-original"]);
  });
});
