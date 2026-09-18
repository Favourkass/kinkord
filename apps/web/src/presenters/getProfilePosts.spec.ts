import { describe, expect, it, vi } from "vitest";
import { getProfilePosts } from "./getProfilePosts";
import type { useFeedPresenter } from "./useFeedPresenter";

type Feed = ReturnType<typeof useFeedPresenter>;

const feed = (over: Partial<Feed> = {}) =>
  ({
    posts: [],
    loading: false,
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
    openMenu: vi.fn(),
    closeMenu: vi.fn(),
    askDelete: vi.fn(),
    toggleExpanded: vi.fn(),
    toggleLike: vi.fn(),
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

describe("getProfilePosts", () => {
  it("hands the tab the feed's posts and its handlers", () => {
    const toggleLike = vi.fn();
    const props = getProfilePosts(feed({ toggleLike }), null);

    props.posts.onLike("p1");
    expect(toggleLike).toHaveBeenCalledWith("p1");
    expect(props.posts.labels.like).toBe("Like");
    expect(props.posts.emptyText).toBe("No posts yet.");
  });

  it("closes the overlays when nothing is selected", () => {
    const props = getProfilePosts(feed(), null);
    expect(props.postOverlays.comments.open).toBe(false);
    expect(props.postOverlays.confirm.open).toBe(false);
    expect(props.postOverlays.lightbox.media).toBeNull();
  });

  it("opens the comment sheet for whichever post is being read", () => {
    const props = getProfilePosts(feed({ commentsFor: "p1" }), "https://s3/me.jpg");
    expect(props.postOverlays.comments.open).toBe(true);
    // The reply box shows the reader's own avatar, not the post author's.
    expect(props.postOverlays.comments.viewerAvatarUrl).toBe("https://s3/me.jpg");
  });

  it("puts the delete confirm in front of a post the member chose to remove", () => {
    const props = getProfilePosts(feed({ confirmDelete: "p1" }), null);
    expect(props.postOverlays.confirm.open).toBe(true);
    expect(props.postOverlays.confirm.message).toMatch(/cannot be undone/i);
  });
});
