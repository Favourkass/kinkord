import { describe, expect, it, vi } from "vitest";
import { getPostList } from "./getPostList";
import type { useFeedPresenter } from "./useFeedPresenter";

type Feed = ReturnType<typeof useFeedPresenter>;

const feed = (over: Partial<Feed> = {}) =>
  ({
    posts: [],
    loading: false,
    error: null,
    loadingMore: false,
    hasMore: false,
    menuFor: null,
    comments: [],
    commentsFor: null,
    commentsLoading: false,
    commentsError: null,
    commentsHasMore: false,
    commentDraft: "",
    commentSending: false,
    canComment: false,
    confirmDelete: null,
    deleting: false,
    lightbox: null,
    shareNote: null,
    openMenu: vi.fn(),
    closeMenu: vi.fn(),
    askDelete: vi.fn(),
    toggleExpanded: vi.fn(),
    toggleLike: vi.fn(),
    toggleRepost: vi.fn(),
    toggleSave: vi.fn(),
    share: vi.fn(),
    dismissShareNote: vi.fn(),
    openComments: vi.fn(),
    openMedia: vi.fn(),
    loadMore: vi.fn(),
    loadMoreComments: vi.fn(),
    setCommentDraft: vi.fn(),
    submitComment: vi.fn(),
    deleteComment: vi.fn(),
    closeComments: vi.fn(),
    confirmDeletePost: vi.fn(),
    cancelDelete: vi.fn(),
    closeMedia: vi.fn(),
    ...over,
  }) as unknown as Feed;

describe("getPostList", () => {
  it("wires every card action to the feed", () => {
    const toggleRepost = vi.fn();
    const toggleSave = vi.fn();
    const share = vi.fn();
    const props = getPostList(feed({ toggleRepost, toggleSave, share }), null);

    props.onRepost("p1");
    props.onSave("p1");
    props.onShare("p1");

    expect(toggleRepost).toHaveBeenCalledWith("p1");
    expect(toggleSave).toHaveBeenCalledWith("p1");
    expect(share).toHaveBeenCalledWith("p1");
  });

  it("keeps the overlays shut when nothing is selected", () => {
    const props = getPostList(feed(), null);
    expect(props.commentsPanel.open).toBe(false);
    expect(props.confirm.open).toBe(false);
    expect(props.lightbox.media).toBeNull();
    expect(props.toast.message).toBeNull();
  });

  it("shows the share confirmation when there is one", () => {
    const props = getPostList(feed({ shareNote: "Link copied" }), null);
    expect(props.toast.message).toBe("Link copied");
  });

  it("passes an error straight through instead of showing an empty list", () => {
    const props = getPostList(feed({ error: "Could not load the feed." }), null);
    expect(props.error).toBe("Could not load the feed.");
  });
});
