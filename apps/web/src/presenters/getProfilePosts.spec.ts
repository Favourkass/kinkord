import { describe, expect, it, vi } from "vitest";
import { toPostVM, type PostPM } from "@/domain/post";
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

describe("getProfilePosts", () => {
  it("hands the tab the feed's posts and its handlers", () => {
    const toggleLike = vi.fn();
    const props = getProfilePosts(feed({ toggleLike }), null);

    props.posts.onLike("p1");
    expect(toggleLike).toHaveBeenCalledWith("p1");
    expect(props.posts.labels.like).toBe("Like");
    expect(props.posts.emptyText).toBe("No posts yet.");
  });

  it("reads the Tagged tab the same way, saying when nobody has tagged the member", () => {
    const removeTag = vi.fn();
    const props = getProfilePosts(feed({ removeTag }), null, null, true);
    expect(props.posts.emptyText).toBe("No tagged posts yet.");
    expect(props.posts.onRemoveTag).toBe(removeTag);
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

  it("makes the header's Follow the one on its own posts, so the two always agree", () => {
    const post = (id: string, userId: string): PostPM => ({
      id,
      postId: id,
      body: "hi",
      visibility: "public",
      createdAt: "2026-09-18T11:00:00.000Z",
      author: {
        userId,
        username: userId,
        displayName: userId,
        avatarUrl: null,
        isFollowing: false,
      },
      media: [],
      likes: 0,
      comments: 0,
      reposts: 0,
      likedByMe: false,
      repostedByMe: false,
      savedByMe: false,
      repostedBy: null,
      mine: false,
    });
    const posts = [toPostVM(post("p1", "org"), false, () => null, new Date(), true)];
    posts.push(toPostVM(post("p2", "kay"), false, () => null, new Date(), false));
    const toggleFollow = vi.fn();
    const onToggle = vi.fn();
    const props = getProfilePosts(feed({ posts, toggleFollow }), null, {
      userId: "org",
      isFollowing: true,
      busy: true,
      onToggle,
    });

    expect(props.posts.posts[0]).toMatchObject({ authorIsFollowing: true, authorFollowBusy: true });
    expect(props.posts.posts[1]).toMatchObject({
      authorIsFollowing: false,
      authorFollowBusy: false,
    });
    props.posts.onTogglePostAuthorFollow("org");
    expect(onToggle).toHaveBeenCalledOnce();
    expect(toggleFollow).not.toHaveBeenCalled();
    // Anyone else's Follow still goes to the feed.
    props.posts.onTogglePostAuthorFollow("kay");
    expect(toggleFollow).toHaveBeenCalledWith("kay");
  });

  it("leaves the feed's own Follow in charge when no header shares one", () => {
    const toggleFollow = vi.fn();
    const props = getProfilePosts(feed({ toggleFollow }), null);
    props.posts.onTogglePostAuthorFollow("org");
    expect(toggleFollow).toHaveBeenCalledWith("org");
  });

  it("puts the delete confirm in front of a post the member chose to remove", () => {
    const props = getProfilePosts(feed({ confirmDelete: "p1" }), null);
    expect(props.postOverlays.confirm.open).toBe(true);
    expect(props.postOverlays.confirm.message).toMatch(/cannot be undone/i);
  });
});
