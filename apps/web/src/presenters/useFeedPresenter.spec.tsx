// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentPM, PostPM } from "@/domain/post";

const replace = vi.fn();
const push = vi.fn();
// Next's useRouter hands back the same object every render; a fresh one here
// would re-fire every effect that depends on it and hide real bugs.
const router = { replace, push };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const feed = vi.fn();
const create = vi.fn();
const like = vi.fn();
const unlike = vi.fn();
const comments = vi.fn();
const comment = vi.fn();
const removeComment = vi.fn();
const removePost = vi.fn();
const suggested = vi.fn();
const recordShare = vi.fn().mockResolvedValue({ postId: "p1", shares: 1 });
const repost = vi.fn();
const unrepost = vi.fn();
const save = vi.fn();
const unsave = vi.fn();
const savedFeed = vi.fn();
const byId = vi.fn();
const follow = vi.fn();
const unfollow = vi.fn();
const uploadPostPhoto = vi.fn();

vi.mock("@/services/posts.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/posts.service")>()),
  postsApi: {
    share: (...a: unknown[]) => recordShare(...a),
    feed: (...a: unknown[]) => feed(...a),
    create: (...a: unknown[]) => create(...a),
    like: (...a: unknown[]) => like(...a),
    unlike: (...a: unknown[]) => unlike(...a),
    comments: (...a: unknown[]) => comments(...a),
    comment: (...a: unknown[]) => comment(...a),
    removeComment: (...a: unknown[]) => removeComment(...a),
    remove: (...a: unknown[]) => removePost(...a),
    byId: (...a: unknown[]) => byId(...a),
    repost: (...a: unknown[]) => repost(...a),
    unrepost: (...a: unknown[]) => unrepost(...a),
    save: (...a: unknown[]) => save(...a),
    unsave: (...a: unknown[]) => unsave(...a),
    saved: (...a: unknown[]) => savedFeed(...a),
    suggested: (...a: unknown[]) => suggested(...a),
    follow: (...a: unknown[]) => follow(...a),
    unfollow: (...a: unknown[]) => unfollow(...a),
  },
  uploadPostPhoto: (...a: unknown[]) => uploadPostPhoto(...a),
}));

const giftBalance = vi.fn();
const giftSend = vi.fn();
vi.mock("@/services/post-gifts.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/post-gifts.service")>();
  return {
    ...original,
    postGiftsService: {
      ...original.postGiftsService,
      balance: (...args: unknown[]) => giftBalance(...args),
      send: (...args: unknown[]) => giftSend(...args),
    },
  };
});

const { useFeedPresenter } = await import("./useFeedPresenter");
const { ApiError } = await import("@/services/apiClient");
const { pendingTransfersService } = await import("@/services/pendingTransfers.service");

const author = { userId: "u2", username: "tega", displayName: "Sir T", avatarUrl: null };

const pm = (over: Partial<PostPM> = {}): PostPM => ({
  id: "p1",
  postId: "p1",
  body: "hello",
  visibility: "public",
  createdAt: "2026-09-18T11:00:00.000Z",
  author,
  media: [],
  likes: 5,
  comments: 1,
  reposts: 0,
  likedByMe: false,
  repostedByMe: false,
  savedByMe: false,
  repostedBy: null,
  mine: false,
  ...over,
});

const commentPm = (over: Partial<CommentPM> = {}): CommentPM => ({
  id: "c1",
  body: "nice",
  createdAt: "2026-09-18T11:30:00.000Z",
  author,
  canDelete: true,
  ...over,
});

beforeEach(() => {
  replace.mockReset();
  feed.mockReset().mockResolvedValue({ items: [pm()], nextCursor: null });
  create.mockReset().mockResolvedValue(pm({ id: "p-new", body: "fresh" }));
  like.mockReset().mockResolvedValue({ postId: "p1", likes: 6, likedByMe: true });
  unlike.mockReset().mockResolvedValue({ postId: "p1", likes: 5, likedByMe: false });
  comments.mockReset().mockResolvedValue({ items: [commentPm()], total: 1, nextCursor: null });
  comment.mockReset().mockResolvedValue(commentPm({ id: "c2", body: "mine" }));
  removeComment.mockReset().mockResolvedValue({ deleted: "c1" });
  removePost.mockReset().mockResolvedValue({ deleted: "p1" });
  suggested.mockReset().mockResolvedValue({ items: [], total: 0 });
  repost.mockReset().mockResolvedValue({ postId: "p1", reposts: 1, repostedByMe: true });
  unrepost.mockReset().mockResolvedValue({ postId: "p1", reposts: 0, repostedByMe: false });
  save.mockReset().mockResolvedValue({ postId: "p1", savedByMe: true });
  unsave.mockReset().mockResolvedValue({ postId: "p1", savedByMe: false });
  savedFeed.mockReset().mockResolvedValue({ items: [pm()], nextCursor: null });
  byId.mockReset().mockResolvedValue(pm());
  follow.mockReset().mockResolvedValue({});
  unfollow.mockReset().mockResolvedValue({});
  uploadPostPhoto.mockReset().mockResolvedValue("posts/u1/a.jpg");
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

const loaded = async () => {
  const hook = renderHook(() => useFeedPresenter());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe("loading the feed", () => {
  it("shows the first page and knows there is nothing after it", async () => {
    const { result } = await loaded();
    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].likes).toBe("5");
    expect(result.current.hasMore).toBe(false);
  });

  it("sends a signed-out member to the login page instead of an error", async () => {
    feed.mockRejectedValue(new ApiError(401, "nope"));
    const { result } = await loaded();
    expect(replace).toHaveBeenCalledWith("/login");
    expect(result.current.error).toBeNull();
  });

  it("explains a real failure rather than showing an empty feed", async () => {
    feed.mockRejectedValue(new ApiError(500, "boom"));
    const { result } = await loaded();
    expect(result.current.error).toMatch(/could not load/i);
  });

  it("appends the next page and keeps what is already on screen", async () => {
    feed.mockResolvedValueOnce({ items: [pm()], nextCursor: "2026-09-18T11:00:00.000Z" });
    const { result } = await loaded();
    expect(result.current.hasMore).toBe(true);

    feed.mockResolvedValueOnce({ items: [pm({ id: "p2" })], nextCursor: null });
    await act(async () => result.current.loadMore());

    expect(result.current.posts.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(result.current.hasMore).toBe(false);
  });

  it("keeps its callbacks stable so an effect that depends on them fires once", async () => {
    const { result, rerender } = await loaded();
    const first = {
      loadMore: result.current.loadMore,
      openComposer: result.current.openComposer,
      closeComments: result.current.closeComments,
    };
    rerender();
    rerender();
    expect(result.current.loadMore).toBe(first.loadMore);
    expect(result.current.openComposer).toBe(first.openComposer);
    expect(result.current.closeComments).toBe(first.closeComments);
  });

  it("asks for the feed once, not once per render", async () => {
    const { rerender } = await loaded();
    rerender();
    rerender();
    expect(feed).toHaveBeenCalledTimes(1);
  });
});

describe("expanding a long post", () => {
  it("toggles one post without touching the others", async () => {
    feed.mockResolvedValue({
      items: [pm({ body: "x".repeat(400) }), pm({ id: "p2", body: "y".repeat(400) })],
      nextCursor: null,
    });
    const { result } = await loaded();
    expect(result.current.posts[0].expanded).toBe(false);

    act(() => result.current.toggleExpanded("p1"));
    expect(result.current.posts[0].expanded).toBe(true);
    expect(result.current.posts[1].expanded).toBe(false);

    act(() => result.current.toggleExpanded("p1"));
    expect(result.current.posts[0].expanded).toBe(false);
  });
});

describe("liking", () => {
  it("shows the like immediately, then takes the server's count", async () => {
    const { result } = await loaded();
    await act(async () => result.current.toggleLike("p1"));

    expect(like).toHaveBeenCalledWith("p1");
    expect(result.current.posts[0].likedByMe).toBe(true);
    expect(result.current.posts[0].likes).toBe("6");
  });

  it("unlikes a post that was already liked", async () => {
    feed.mockResolvedValue({ items: [pm({ likedByMe: true, likes: 6 })], nextCursor: null });
    const { result } = await loaded();
    await act(async () => result.current.toggleLike("p1"));

    expect(unlike).toHaveBeenCalledWith("p1");
    expect(result.current.posts[0].likedByMe).toBe(false);
  });

  it("puts the heart back when the request fails", async () => {
    like.mockRejectedValue(new ApiError(500, "boom"));
    const { result } = await loaded();
    await act(async () => result.current.toggleLike("p1"));

    expect(result.current.posts[0].likedByMe).toBe(false);
    expect(result.current.posts[0].likes).toBe("5");
  });
});

describe("the composer", () => {
  it("will not post nothing", async () => {
    const { result } = await loaded();
    act(() => result.current.openComposer());
    expect(result.current.canPost).toBe(false);

    act(() => result.current.setDraft("  "));
    expect(result.current.canPost).toBe(false);

    act(() => result.current.setDraft("something"));
    expect(result.current.canPost).toBe(true);
  });

  it("puts the new post at the top of the feed and clears the draft", async () => {
    const { result } = await loaded();
    act(() => result.current.openComposer());
    act(() => result.current.setDraft("fresh"));
    await act(async () => result.current.submitPost());

    expect(create).toHaveBeenCalledWith({ body: "fresh", visibility: "public", mediaKeys: [] });
    expect(result.current.posts[0].id).toBe("p-new");
    expect(result.current.composerOpen).toBe(false);
    expect(result.current.draft).toBe("");
  });

  it("keeps the draft on screen when publishing fails", async () => {
    create.mockRejectedValue(new ApiError(500, "Something went wrong"));
    const { result } = await loaded();
    act(() => result.current.openComposer());
    act(() => result.current.setDraft("fresh"));
    await act(async () => result.current.submitPost());

    expect(result.current.composerOpen).toBe(true);
    expect(result.current.draft).toBe("fresh");
    expect(result.current.composerError).toBe("Something went wrong");
  });

  it("uploads a picked photo and counts the slot as used", async () => {
    const { result } = await loaded();
    act(() => result.current.openComposer());
    await act(async () => {
      result.current.addPhotos([new File(["x"], "a.jpg", { type: "image/jpeg" })]);
    });

    await waitFor(() => expect(result.current.photos[0].uploading).toBe(false));
    expect(uploadPostPhoto).toHaveBeenCalledTimes(1);
    expect(result.current.photoSlots).toBe(3);
    expect(result.current.canPost).toBe(true);
  });

  it("takes only as many photos as there is room for, and says so", async () => {
    const { result } = await loaded();
    act(() => result.current.openComposer());
    const files = Array.from(
      { length: 6 },
      (_, i) => new File(["x"], `${i}.jpg`, { type: "image/jpeg" }),
    );
    await act(async () => result.current.addPhotos(files));

    expect(result.current.photos).toHaveLength(4);
    expect(result.current.composerError).toMatch(/up to 4/i);
  });

  it("marks the tile that failed rather than the whole post", async () => {
    uploadPostPhoto.mockRejectedValue(new ApiError(0, "Upload failed — your connection dropped."));
    const { result } = await loaded();
    act(() => result.current.openComposer());
    await act(async () => {
      result.current.addPhotos([new File(["x"], "a.jpg", { type: "image/jpeg" })]);
    });

    await waitFor(() => expect(result.current.photos[0].error).toMatch(/connection dropped/));
    expect(result.current.canPost).toBe(false);
  });

  it("holds the post while a photo is still going up", async () => {
    let settle: (key: string) => void = () => {};
    uploadPostPhoto.mockReturnValue(
      new Promise<string>((resolve) => {
        settle = resolve;
      }),
    );
    const { result } = await loaded();
    act(() => result.current.openComposer());
    act(() => result.current.setDraft("with a photo"));
    await act(async () => {
      result.current.addPhotos([new File(["x"], "a.jpg", { type: "image/jpeg" })]);
    });
    await act(async () => result.current.submitPost());

    expect(create).not.toHaveBeenCalled();
    expect(result.current.composerError).toMatch(/still uploading/i);
    await act(async () => settle("posts/u1/a.jpg"));
  });

  it("drops the previews when the composer is closed", async () => {
    const { result } = await loaded();
    act(() => result.current.openComposer());
    await act(async () => {
      result.current.addPhotos([new File(["x"], "a.jpg", { type: "image/jpeg" })]);
    });
    act(() => result.current.closeComposer());

    expect(result.current.photos).toHaveLength(0);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("opens straight on the file picker from the photo shortcut", async () => {
    const { result } = await loaded();
    act(() => result.current.openComposerWithPhoto());
    expect(result.current.composerOpen).toBe(true);
    expect(result.current.autoPickPhoto).toBe(true);

    act(() => result.current.closeComposer());
    act(() => result.current.openComposer());
    expect(result.current.autoPickPhoto).toBe(false);
  });
});

describe("comments", () => {
  it("loads the thread for the post that was tapped", async () => {
    const { result } = await loaded();
    await act(async () => result.current.openComments("p1"));

    expect(comments).toHaveBeenCalledWith("p1");
    expect(result.current.commentsFor).toBe("p1");
    expect(result.current.comments[0].body).toBe("nice");
  });

  it("adds a new comment at the top and bumps the card's count", async () => {
    const { result } = await loaded();
    await act(async () => result.current.openComments("p1"));
    act(() => result.current.setCommentDraft("  mine  "));
    await act(async () => result.current.submitComment());

    expect(comment).toHaveBeenCalledWith("p1", "mine");
    expect(result.current.comments[0].id).toBe("c2");
    expect(result.current.posts[0].comments).toBe("2");
    expect(result.current.commentDraft).toBe("");
  });

  it("will not send an empty comment", async () => {
    const { result } = await loaded();
    await act(async () => result.current.openComments("p1"));
    act(() => result.current.setCommentDraft("   "));
    expect(result.current.canComment).toBe(false);

    await act(async () => result.current.submitComment());
    expect(comment).not.toHaveBeenCalled();
  });

  it("removes a comment and takes it off the count", async () => {
    const { result } = await loaded();
    await act(async () => result.current.openComments("p1"));
    await act(async () => result.current.deleteComment("c1"));

    expect(removeComment).toHaveBeenCalledWith("c1");
    expect(result.current.comments).toHaveLength(0);
    expect(result.current.posts[0].comments).toBe("0");
  });

  it("puts a comment back when the delete fails", async () => {
    removeComment.mockRejectedValue(new ApiError(500, "boom"));
    const { result } = await loaded();
    await act(async () => result.current.openComments("p1"));
    await act(async () => result.current.deleteComment("c1"));

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.posts[0].comments).toBe("1");
    expect(result.current.commentsError).toMatch(/could not delete/i);
  });

  it("closes and forgets the thread", async () => {
    const { result } = await loaded();
    await act(async () => result.current.openComments("p1"));
    act(() => result.current.closeComments());

    expect(result.current.commentsFor).toBeNull();
    expect(result.current.comments).toHaveLength(0);
  });
});

describe("deleting a post", () => {
  it("asks first, then removes it from the feed", async () => {
    const { result } = await loaded();
    act(() => result.current.openMenu("p1"));
    act(() => result.current.askDelete("p1"));

    expect(result.current.menuFor).toBeNull();
    expect(result.current.confirmDelete).toBe("p1");
    expect(removePost).not.toHaveBeenCalled();

    await act(async () => result.current.confirmDeletePost());
    expect(removePost).toHaveBeenCalledWith("p1");
    expect(result.current.posts).toHaveLength(0);
  });

  it("calls an un-repost an un-repost, not a delete", async () => {
    // A repost shows somebody else's words. Offering to "delete this post"
    // there reads as destroying their post, which it never does.
    feed.mockResolvedValue({
      items: [
        pm({
          id: "r1",
          postId: "p1",
          mine: true,
          repostedBy: { userId: "me", username: "favour", displayName: "Favour" },
        }),
      ],
      nextCursor: null,
    });
    const { result } = await loaded();
    expect(result.current.posts[0].isRepost).toBe(true);

    act(() => result.current.askDelete("r1"));
    expect(result.current.confirmDeleteIsRepost).toBe(true);

    // And the row that is removed is the repost, not the post it points at.
    await act(async () => result.current.confirmDeletePost());
    expect(removePost).toHaveBeenCalledWith("r1");
  });

  it("still calls deleting your own post a delete", async () => {
    feed.mockResolvedValue({ items: [pm({ mine: true })], nextCursor: null });
    const { result } = await loaded();
    act(() => result.current.askDelete("p1"));
    expect(result.current.confirmDeleteIsRepost).toBe(false);
  });

  it("leaves the post alone when the member backs out", async () => {
    const { result } = await loaded();
    act(() => result.current.askDelete("p1"));
    act(() => result.current.cancelDelete());

    expect(result.current.confirmDelete).toBeNull();
    expect(removePost).not.toHaveBeenCalled();
    expect(result.current.posts).toHaveLength(1);
  });
});

describe("people you may know", () => {
  const person = {
    userId: "u3",
    username: "kay",
    displayName: "Kay",
    avatarUrl: null,
    isFollowing: false,
  };

  it("follows optimistically and rolls back on failure", async () => {
    suggested.mockResolvedValue({ items: [person], total: 1 });
    follow.mockRejectedValue(new ApiError(500, "boom"));
    const { result } = await loaded();
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    await act(async () => result.current.toggleFollow("u3"));
    expect(follow).toHaveBeenCalledWith("kay");
    expect(result.current.suggestions[0].isFollowing).toBe(false);
  });

  it("hides the strip for the rest of the session", async () => {
    suggested.mockResolvedValue({ items: [person], total: 1 });
    const { result } = await loaded();
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    act(() => result.current.hideSuggestions());
    expect(result.current.suggestions).toHaveLength(0);
  });

  it("leaves the feed working when suggestions fail to load", async () => {
    suggested.mockRejectedValue(new ApiError(500, "boom"));
    const { result } = await loaded();
    expect(result.current.posts).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });
});

describe("searching (the search page's Posts)", () => {
  it("asks for the posts that contain the words, without the suggestions strip", async () => {
    const hook = renderHook(() => useFeedPresenter({ search: "brunch" }));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(feed).toHaveBeenCalledWith(null, undefined, null, "brunch");
    expect(suggested).not.toHaveBeenCalled();
  });

  it("drops a next page that arrives after the search changed", async () => {
    let release: (page: unknown) => void = () => undefined;
    feed.mockImplementation(
      async (cursor: string | null, _limit: unknown, _author: unknown, search: string) => {
        if (search === "lunch") return { items: [pm({ id: "b1" })], nextCursor: null };
        if (cursor === null) return { items: [pm({ id: "a1" })], nextCursor: "c1" };
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    );
    const hook = renderHook(({ search }: { search: string }) => useFeedPresenter({ search }), {
      initialProps: { search: "brunch" },
    });
    await waitFor(() => expect(hook.result.current.hasMore).toBe(true));
    act(() => {
      void hook.result.current.loadMore();
    });
    hook.rerender({ search: "lunch" });
    await waitFor(() => expect(hook.result.current.posts.map((p) => p.id)).toEqual(["b1"]));
    await act(async () => release({ items: [pm({ id: "a2" })], nextCursor: "c2" }));
    // "brunch"'s second page belongs to "brunch": it never joins "lunch".
    expect(hook.result.current.posts.map((p) => p.id)).toEqual(["b1"]);
    expect(hook.result.current.hasMore).toBe(false);
  });

  it("offers no next page while a new search's first page loads", async () => {
    let release: (page: unknown) => void = () => undefined;
    feed.mockImplementation(
      async (_cursor: unknown, _limit: unknown, _author: unknown, search: string) =>
        search === "brunch"
          ? { items: [pm({ id: "a1" })], nextCursor: "c1" }
          : new Promise((resolve) => {
              release = resolve;
            }),
    );
    const hook = renderHook(({ search }: { search: string }) => useFeedPresenter({ search }), {
      initialProps: { search: "brunch" },
    });
    await waitFor(() => expect(hook.result.current.hasMore).toBe(true));
    hook.rerender({ search: "lunch" });
    expect(hook.result.current.loading).toBe(true);
    // "brunch"'s cursor would page "lunch" from the wrong place.
    expect(hook.result.current.hasMore).toBe(false);
    await act(async () => {
      await hook.result.current.loadMore();
    });
    expect(feed).not.toHaveBeenCalledWith("c1", undefined, null, "lunch");
    await act(async () => release({ items: [pm({ id: "b1" })], nextCursor: null }));
    expect(hook.result.current.posts.map((p) => p.id)).toEqual(["b1"]);
  });

  it("drops a next page asked for before the same list started again", async () => {
    let release: (page: unknown) => void = () => undefined;
    feed.mockImplementation(async (cursor: string | null) =>
      cursor === null
        ? { items: [pm({ id: "a1" })], nextCursor: "c1" }
        : new Promise((resolve) => {
            release = resolve;
          }),
    );
    const hook = renderHook(
      ({ ready }: { ready: boolean }) => useFeedPresenter({ search: "brunch", ready }),
      { initialProps: { ready: true } },
    );
    await waitFor(() => expect(hook.result.current.hasMore).toBe(true));
    act(() => {
      void hook.result.current.loadMore();
    });
    hook.rerender({ ready: false });
    hook.rerender({ ready: true });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => release({ items: [pm({ id: "a3" })], nextCursor: "c3" }));
    // Its first page again, with page two still to come, not page three after page one.
    expect(hook.result.current.posts.map((p) => p.id)).toEqual(["a1"]);
    expect(hook.result.current.hasMore).toBe(true);
  });

  it("shows a failed search's error without the last search's posts, and clears it after", async () => {
    feed.mockImplementation(
      async (_cursor: unknown, _limit: unknown, _author: unknown, search: string) => {
        if (search === "lunch") throw new Error("offline");
        return { items: [pm({ id: search })], nextCursor: "next" };
      },
    );
    const hook = renderHook(({ search }: { search: string }) => useFeedPresenter({ search }), {
      initialProps: { search: "brunch" },
    });
    await waitFor(() => expect(hook.result.current.posts.map((p) => p.id)).toEqual(["brunch"]));
    hook.rerender({ search: "lunch" });
    await waitFor(() => expect(hook.result.current.error).not.toBeNull());
    expect(hook.result.current.posts).toEqual([]);
    expect(hook.result.current.hasMore).toBe(false);
    hook.rerender({ search: "dinner" });
    await waitFor(() => expect(hook.result.current.posts.map((p) => p.id)).toEqual(["dinner"]));
    expect(hook.result.current.error).toBeNull();
  });

  it("never lets another search's slow next page hold up this one's", async () => {
    feed.mockImplementation(
      async (cursor: string | null, _limit: unknown, _author: unknown, search: string) => {
        if (search === "brunch" && cursor) return new Promise(() => undefined);
        return { items: [pm({ id: `${search}-1` })], nextCursor: `${search}-c1` };
      },
    );
    const hook = renderHook(({ search }: { search: string }) => useFeedPresenter({ search }), {
      initialProps: { search: "brunch" },
    });
    await waitFor(() => expect(hook.result.current.hasMore).toBe(true));
    act(() => {
      void hook.result.current.loadMore();
    });
    expect(hook.result.current.loadingMore).toBe(true);
    hook.rerender({ search: "lunch" });
    await waitFor(() => expect(hook.result.current.posts.map((p) => p.id)).toEqual(["lunch-1"]));
    expect(hook.result.current.loadingMore).toBe(false);
    await act(async () => {
      await hook.result.current.loadMore();
    });
    expect(feed).toHaveBeenLastCalledWith("lunch-c1", undefined, null, "lunch");
  });

  it("lets only the request that is loading the next page unlock it", async () => {
    const pending: Array<(page: unknown) => void> = [];
    feed.mockImplementation(
      async (cursor: string | null, _limit: unknown, _author: unknown, search: string) =>
        cursor
          ? new Promise((resolve) => pending.push(resolve))
          : { items: [pm({ id: `${search}-1` })], nextCursor: `${search}-c1` },
    );
    const hook = renderHook(({ search }: { search: string }) => useFeedPresenter({ search }), {
      initialProps: { search: "brunch" },
    });
    await waitFor(() => expect(hook.result.current.hasMore).toBe(true));
    act(() => {
      void hook.result.current.loadMore();
    });
    // Away to another search and back, then the next page again.
    hook.rerender({ search: "lunch" });
    await waitFor(() => expect(hook.result.current.posts.map((p) => p.id)).toEqual(["lunch-1"]));
    hook.rerender({ search: "brunch" });
    await waitFor(() => expect(hook.result.current.posts.map((p) => p.id)).toEqual(["brunch-1"]));
    act(() => {
      void hook.result.current.loadMore();
    });
    expect(pending).toHaveLength(2);
    // The first, stale request settles: it must not unlock the second.
    await act(async () => pending[0]({ items: [pm({ id: "stale" })], nextCursor: null }));
    expect(hook.result.current.loadingMore).toBe(true);
    act(() => {
      void hook.result.current.loadMore();
    });
    expect(pending).toHaveLength(2);
    await act(async () => pending[1]({ items: [pm({ id: "brunch-2" })], nextCursor: null }));
    expect(hook.result.current.posts.map((p) => p.id)).toEqual(["brunch-1", "brunch-2"]);
  });

  it("can't page the same search typed again until its fresh first page is in", async () => {
    const firsts: Array<(page: unknown) => void> = [];
    let firstCalls = 0;
    feed.mockImplementation(async (cursor: string | null) => {
      if (cursor) return { items: [pm({ id: "p2" })], nextCursor: null };
      firstCalls += 1;
      if (firstCalls === 1) return { items: [pm({ id: "p1" })], nextCursor: "c1" };
      return new Promise((resolve) => firsts.push(resolve));
    });
    const hook = renderHook(
      ({ search, ready }: { search: string; ready: boolean }) =>
        useFeedPresenter({ search, ready }),
      { initialProps: { search: "brunch", ready: true } },
    );
    await waitFor(() => expect(hook.result.current.hasMore).toBe(true));
    // Cleared, then the same words again: a fresh first page is on its way.
    hook.rerender({ search: "", ready: false });
    hook.rerender({ search: "brunch", ready: true });
    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.hasMore).toBe(false);
    await act(async () => {
      await hook.result.current.loadMore();
      await hook.result.current.loadMore();
    });
    expect(feed).not.toHaveBeenCalledWith("c1", undefined, null, "brunch");
    await act(async () => firsts[0]({ items: [pm({ id: "p1" })], nextCursor: "c1" }));
    expect(hook.result.current.posts.map((p) => p.id)).toEqual(["p1"]);
  });

  it("loads a search gone back to before the one in between loaded", async () => {
    const pendingFirsts: Array<(page: unknown) => void> = [];
    let brunchFirsts = 0;
    feed.mockImplementation(
      async (cursor: string | null, _limit: unknown, _author: unknown, search: string) => {
        if (search === "lunch" || (search === "brunch" && !cursor && ++brunchFirsts > 1))
          return new Promise((resolve) => pendingFirsts.push(resolve));
        return { items: [pm({ id: "p1" })], nextCursor: "c1" };
      },
    );
    const hook = renderHook(({ search }: { search: string }) => useFeedPresenter({ search }), {
      initialProps: { search: "brunch" },
    });
    await waitFor(() => expect(hook.result.current.hasMore).toBe(true));
    hook.rerender({ search: "lunch" });
    hook.rerender({ search: "brunch" });
    // Back to brunch before lunch loaded: brunch is loading again, not paging.
    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.hasMore).toBe(false);
  });

  it("reads again for each new search", async () => {
    const hook = renderHook(({ search }: { search: string }) => useFeedPresenter({ search }), {
      initialProps: { search: "brunch" },
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    hook.rerender({ search: "lunch" });
    await waitFor(() => expect(feed).toHaveBeenLastCalledWith(null, undefined, null, "lunch"));
  });
});

describe("pointed at one member (the profile Posts tab)", () => {
  it("asks for that member's posts, not the whole feed", async () => {
    const hook = renderHook(() => useFeedPresenter({ author: "tega" }));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(feed).toHaveBeenCalledWith(null, undefined, "tega", null);
  });

  it("leaves the suggestions strip to the home feed", async () => {
    const hook = renderHook(() => useFeedPresenter({ author: "tega" }));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(suggested).not.toHaveBeenCalled();
    expect(hook.result.current.suggestions).toHaveLength(0);
  });

  it("loads nothing until the handle is known", async () => {
    // /profile has to ask the API who you are first; without this gate the very
    // first render would fetch the home feed and show it under your Posts tab.
    const { result, rerender } = renderHook(
      ({ author }: { author: string | null }) =>
        useFeedPresenter({ author, ready: Boolean(author) }),
      { initialProps: { author: null as string | null } },
    );
    expect(feed).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);

    rerender({ author: "favour" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(feed).toHaveBeenCalledTimes(1);
    expect(feed).toHaveBeenCalledWith(null, undefined, "favour", null);
  });

  it("shows a load, not the last member's posts, when you walk to another profile", async () => {
    const { result, rerender } = renderHook(
      ({ author }: { author: string }) => useFeedPresenter({ author }),
      { initialProps: { author: "tega" } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toHaveLength(1);

    let settle: (page: unknown) => void = () => {};
    feed.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    rerender({ author: "ada" });

    expect(result.current.loading).toBe(true);
    await act(async () => settle({ items: [pm({ id: "p9" })], nextCursor: null }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts.map((p) => p.id)).toEqual(["p9"]);
  });

  it("keeps the member's handle on the next page too", async () => {
    feed.mockResolvedValueOnce({ items: [pm()], nextCursor: "2026-09-18T11:00:00.000Z" });
    const { result } = renderHook(() => useFeedPresenter({ author: "tega" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.loadMore());
    expect(feed).toHaveBeenLastCalledWith("2026-09-18T11:00:00.000Z", undefined, "tega", null);
  });
});

describe("reposting", () => {
  it("shows the repost immediately, then takes the server's count", async () => {
    const { result } = await loaded();
    await act(async () => result.current.toggleRepost("p1"));

    expect(repost).toHaveBeenCalledWith("p1");
    expect(result.current.posts[0].repostedByMe).toBe(true);
    expect(result.current.posts[0].reposts).toBe("1");
  });

  it("undoes a repost that was already made", async () => {
    feed.mockResolvedValue({
      items: [pm({ repostedByMe: true, reposts: 1 })],
      nextCursor: null,
    });
    const { result } = await loaded();
    await act(async () => result.current.toggleRepost("p1"));

    expect(unrepost).toHaveBeenCalledWith("p1");
    expect(result.current.posts[0].repostedByMe).toBe(false);
  });

  it("rolls back when the request fails", async () => {
    repost.mockRejectedValue(new ApiError(403, "Friends-only posts cannot be reposted"));
    const { result } = await loaded();
    await act(async () => result.current.toggleRepost("p1"));

    expect(result.current.posts[0].repostedByMe).toBe(false);
    expect(result.current.posts[0].reposts).toBe("0");
  });

  it("keeps a post and a repost of it in agreement", async () => {
    // Both rows show the same post, so one server answer has to move both.
    feed.mockResolvedValue({
      items: [pm({ id: "r1", postId: "p1" }), pm({ id: "p1", postId: "p1" })],
      nextCursor: null,
    });
    const { result } = await loaded();
    await act(async () => result.current.toggleLike("p1"));

    expect(result.current.posts.map((p) => p.likedByMe)).toEqual([true, true]);
    expect(result.current.posts.map((p) => p.likes)).toEqual(["6", "6"]);
  });
});

describe("saving", () => {
  it("saves and unsaves", async () => {
    const { result } = await loaded();
    await act(async () => result.current.toggleSave("p1"));
    expect(save).toHaveBeenCalledWith("p1");
    expect(result.current.posts[0].savedByMe).toBe(true);

    await act(async () => result.current.toggleSave("p1"));
    expect(unsave).toHaveBeenCalledWith("p1");
    expect(result.current.posts[0].savedByMe).toBe(false);
  });

  it("rolls back a save that failed", async () => {
    save.mockRejectedValue(new ApiError(500, "boom"));
    const { result } = await loaded();
    await act(async () => result.current.toggleSave("p1"));
    expect(result.current.posts[0].savedByMe).toBe(false);
  });

  it("reads the saved list instead of the feed when asked", async () => {
    const hook = renderHook(() => useFeedPresenter({ saved: true }));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(savedFeed).toHaveBeenCalled();
    expect(feed).not.toHaveBeenCalled();
    expect(suggested).not.toHaveBeenCalled();
  });
});

describe("sharing", () => {
  const origin = "https://kinkord.com";

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: { origin, href: `${origin}/home` },
      writable: true,
    });
  });

  it("hands the link to the system share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });

    const { result } = await loaded();
    await act(async () => result.current.share("p1"));

    expect(share).toHaveBeenCalledWith({ url: `${origin}/p/p1` });
    expect(recordShare).toHaveBeenCalledWith("p1");
    expect(result.current.posts[0].shares).toBe("1");

    // The sheet is its own confirmation; no toast on top of it.
    expect(result.current.shareNote).toBeNull();
    Reflect.deleteProperty(navigator, "share");
  });

  it("copies the link and says so where there is no share sheet", async () => {
    Reflect.deleteProperty(navigator, "share");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const { result } = await loaded();
    await act(async () => result.current.share("p1"));

    expect(writeText).toHaveBeenCalledWith(`${origin}/p/p1`);
    expect(result.current.shareNote).toBe("Link copied");
    expect(recordShare).toHaveBeenCalledWith("p1");
    expect(result.current.posts[0].shares).toBe("1");

    act(() => result.current.dismissShareNote());
    expect(result.current.shareNote).toBeNull();
  });

  it("stays quiet when the member cancels the share sheet", async () => {
    const share = vi.fn().mockRejectedValue(new Error("AbortError"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });

    const { result } = await loaded();
    await act(async () => result.current.share("p1"));

    expect(result.current.shareNote).toBeNull();
    expect(recordShare).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "share");
  });
});

describe("one post on its own", () => {
  it("reads just that post", async () => {
    const hook = renderHook(() => useFeedPresenter({ postId: "p1" }));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(byId).toHaveBeenCalledWith("p1");
    expect(feed).not.toHaveBeenCalled();
    expect(hook.result.current.posts).toHaveLength(1);
    expect(hook.result.current.hasMore).toBe(false);
  });
});

describe("post gifting presenter", () => {
  it("opens the requested currency and prevents a double-click from sending two gifts", async () => {
    giftBalance.mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "star", available: 5, reserved: 0 }],
    });
    let finish!: () => void;
    giftSend.mockReset().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1", "star");
    });
    expect(result.current.giftDialog.currency).toBe("star");
    expect(result.current.giftDialog.canSend).toBe(true);
    act(() => {
      void result.current.giftDialog.onSend();
      void result.current.giftDialog.onSend();
    });
    expect(giftSend).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    expect(result.current.giftDialog.open).toBe(false);
    expect(result.current.shareNote).toContain("Sent 1 Star to Sir T");
  });
  it("keeps the same request key when retrying a lost response", async () => {
    giftBalance.mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    giftSend
      .mockReset()
      .mockRejectedValueOnce(new ApiError(0, "Network problem"))
      .mockResolvedValueOnce({});
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    expect(result.current.giftDialog.open).toBe(true);
    expect(result.current.giftDialog.locked).toBe(true);
    act(() => {
      result.current.giftDialog.onClose();
    });
    giftBalance.mockResolvedValueOnce({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 0, reserved: 0 }],
    });
    await act(async () => {
      await result.current.openGift("p1", "star");
    });
    expect(result.current.giftDialog.currency).toBe("coin");
    expect(result.current.giftDialog.canSend).toBe(true);
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    expect(giftSend.mock.calls[0]).toEqual(giftSend.mock.calls[1]);
  });
  it("brings back a gift left in doubt before a reload, with its key", async () => {
    pendingTransfersService.keepGift("me", {
      postId: "p1",
      currency: "star",
      quantity: "2",
      key: "kept-key",
    });
    giftBalance.mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "star", available: 5, reserved: 0 }],
    });
    giftSend.mockReset().mockResolvedValueOnce({});
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1", "coin");
    });
    expect(result.current.giftDialog.locked).toBe(true);
    expect(result.current.giftDialog.currency).toBe("star");
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    expect(giftSend).toHaveBeenCalledWith("p1", "star", 2, "kept-key", "me");
    expect(pendingTransfersService.gifts("me")).toEqual([]);
    localStorage.clear();
  });
  it("settles an earlier gift whose post has gone before opening another", async () => {
    pendingTransfersService.keepGift("me", {
      postId: "gone",
      currency: "star",
      quantity: "2",
      key: "kept-key",
    });
    giftBalance.mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    giftSend.mockReset().mockResolvedValueOnce({});
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    // Sent again as it was, though its post isn't here: the server answers for it.
    expect(giftSend).toHaveBeenCalledWith("gone", "star", 2, "kept-key", "me");
    expect(result.current.shareNote).toBe("Your earlier gift went through.");
    expect(pendingTransfersService.gifts("me")).toEqual([]);
    expect(result.current.giftDialog.open).toBe(true);
    expect(result.current.giftDialog.locked).toBe(false);
    // The balance is read again after the earlier gift went through.
    expect(giftBalance).toHaveBeenCalledTimes(2);
  });
  it("keeps a gift before it's sent, so a reload mid-send keeps its key", async () => {
    giftBalance.mockReset().mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    let answer: () => void = () => undefined;
    giftSend
      .mockReset()
      .mockImplementation(() => new Promise<void>((resolve) => (answer = () => resolve())));
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    act(() => {
      void result.current.giftDialog.onSend();
    });
    expect(pendingTransfersService.gifts("me")).toEqual([
      expect.objectContaining({ postId: "p1", key: giftSend.mock.calls[0][3] }),
    ]);
    await act(async () => {
      answer();
    });
    expect(pendingTransfersService.gifts("me")).toEqual([]);
  });
  it("takes the kept copy over its own memory: another tab may have settled it or kept a newer one", async () => {
    giftBalance.mockReset().mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    giftSend.mockReset().mockRejectedValueOnce(new ApiError(0, "Network problem"));
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    act(() => {
      result.current.giftDialog.onClose();
    });
    // Another tab settled that one and kept a newer gift, still in doubt.
    localStorage.clear();
    pendingTransfersService.keepGift("me", {
      postId: "p1",
      currency: "coin",
      quantity: "3",
      key: "newer",
    });
    await act(async () => {
      await result.current.openGift("p1");
    });
    expect(result.current.giftDialog.locked).toBe(true);
    expect(result.current.giftDialog.quantity).toBe("3");
    giftSend.mockResolvedValueOnce({});
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    expect(giftSend.mock.calls.at(-1)?.[3]).toBe("newer");
    // And once it's settled elsewhere, nothing is in doubt here.
    localStorage.clear();
    await act(async () => {
      await result.current.openGift("p1");
    });
    expect(result.current.giftDialog.locked).toBe(false);
  });
  it("won't start a gift over another tab's one still in doubt", async () => {
    giftBalance.mockReset().mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    giftSend.mockReset();
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    pendingTransfersService.keepGift("me", {
      postId: "p1",
      currency: "coin",
      quantity: "1",
      key: "other-tab",
    });
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    expect(giftSend).not.toHaveBeenCalled();
    expect(result.current.giftDialog.error).toMatch(/earlier gift/);
    localStorage.clear();
  });
  it("stops recovering when another account is signed in partway", async () => {
    pendingTransfersService.keepGift("me", {
      postId: "gone",
      currency: "star",
      quantity: "2",
      key: "kept-key",
    });
    giftBalance
      .mockReset()
      .mockResolvedValueOnce({
        userId: "me",
        settings: { enabled: true },
        balances: [{ currency: "coin", available: 5, reserved: 0 }],
      })
      .mockResolvedValue({
        userId: "someone-else",
        settings: { enabled: true },
        balances: [{ currency: "coin", available: 5, reserved: 0 }],
      });
    giftSend.mockReset().mockResolvedValueOnce({});
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    expect(result.current.giftDialog.open).toBe(false);
    expect(result.current.shareNote).toMatch(/someone else/);
    localStorage.clear();
  });
  it("still retries with its key a gift this browser couldn't keep", async () => {
    giftBalance.mockReset().mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    giftSend.mockReset().mockRejectedValueOnce(new ApiError(0, "Network problem"));
    const full = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    act(() => {
      result.current.giftDialog.onClose();
    });
    await act(async () => {
      await result.current.openGift("p1");
    });
    // Not kept anywhere, but still this page's own: the same gift, same key.
    expect(result.current.giftDialog.locked).toBe(true);
    giftSend.mockResolvedValueOnce({});
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    expect(giftSend.mock.calls[1][3]).toBe(giftSend.mock.calls[0][3]);
    full.mockRestore();
  });
  it("settles every other tab's gift first, then retries this post's own", async () => {
    pendingTransfersService.keepGift("me", {
      postId: "gone",
      currency: "star",
      quantity: "2",
      key: "b",
    });
    pendingTransfersService.keepGift("me", {
      postId: "p1",
      currency: "coin",
      quantity: "3",
      key: "a",
    });
    giftBalance.mockReset().mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    giftSend.mockReset().mockResolvedValue({});
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    expect(giftSend).toHaveBeenCalledWith("gone", "star", 2, "b", "me");
    expect(result.current.giftDialog.locked).toBe(true);
    expect(result.current.giftDialog.quantity).toBe("3");
    expect(pendingTransfersService.gifts("me").map((g) => g.key)).toEqual(["a"]);
    localStorage.clear();
  });
  it("sends nothing while it can't tell whose wallet it is", async () => {
    giftBalance.mockReset().mockRejectedValue(new Error("offline"));
    giftSend.mockReset();
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    expect(giftSend).not.toHaveBeenCalled();
    expect(result.current.giftDialog.error).toBe("offline");
  });
  it("never sends another account's gift in doubt", async () => {
    giftBalance.mockReset().mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    giftSend.mockReset().mockRejectedValueOnce(new ApiError(0, "Network problem"));
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    act(() => {
      result.current.giftDialog.onClose();
    });
    // Another tab signs in as someone else.
    giftBalance.mockResolvedValue({
      userId: "someone-else",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    await act(async () => {
      await result.current.openGift("p1");
    });
    expect(result.current.giftDialog.locked).toBe(false);
    expect(giftSend).toHaveBeenCalledTimes(1);
    // Still kept for its sender.
    expect(pendingTransfersService.gifts("me")).toHaveLength(1);
    localStorage.clear();
  });
  it("keeps a gift in doubt when its retry finds them signed out", async () => {
    giftBalance.mockResolvedValue({
      userId: "me",
      settings: { enabled: true },
      balances: [{ currency: "coin", available: 5, reserved: 0 }],
    });
    giftSend
      .mockReset()
      .mockRejectedValueOnce(new ApiError(0, "Network problem"))
      .mockRejectedValueOnce(new ApiError(401, "Sign in again."))
      .mockResolvedValueOnce({});
    const { result } = renderHook(() => useFeedPresenter());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    await act(async () => {
      await result.current.openGift("p1");
    });
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    // Still in doubt: reopening offers the same gift, with the same key.
    expect(result.current.giftDialog.locked).toBe(true);
    act(() => {
      result.current.giftDialog.onClose();
    });
    await act(async () => {
      await result.current.openGift("p1");
    });
    expect(result.current.giftDialog.locked).toBe(true);
    await act(async () => {
      await result.current.giftDialog.onSend();
    });
    expect(giftSend.mock.calls[2]).toEqual(giftSend.mock.calls[0]);
  });
});
