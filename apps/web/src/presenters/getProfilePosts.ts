import { FEED_COPY, POST_CARD_LABELS } from "@/constants/feed";
import { MEMBERS_COPY } from "@/constants/members";
import { COMMENT_BODY_MAX } from "@/domain/post";
import type { useFeedPresenter } from "./useFeedPresenter";

type Feed = ReturnType<typeof useFeedPresenter>;

/** The profile header's Follow, as `useMemberProfilePresenter` hands it out. */
export interface AuthorFollow {
  userId: string;
  isFollowing: boolean;
  busy: boolean;
  onToggle: () => void;
}

/**
 * Turns a feed pointed at one member into the Posts tab's props plus its three
 * overlays. Both /profile and /u/[username] render the same tab, so the wiring
 * lives here rather than being copied into each page.
 *
 * On a member's page their own posts' Follow button (the organization's) is
 * the header's Follow, given as `authorFollow`: one state, so following in
 * either place shows in both.
 *
 * Deliberately returns a plain shape: presenters may not import from
 * `components/`, and the page's call site type-checks it against
 * `ProfileScreenProps` anyway.
 */
export function getProfilePosts(
  feed: Feed,
  viewerAvatarUrl: string | null,
  authorFollow: AuthorFollow | null = null,
  /** The Tagged tab reads the same way, over the posts that tag the member. */
  tagged = false,
) {
  const copy = MEMBERS_COPY.profile.posts;
  const posts = authorFollow
    ? feed.posts.map((post) =>
        post.authorUserId === authorFollow.userId
          ? {
              ...post,
              authorIsFollowing: authorFollow.isFollowing,
              authorFollowBusy: authorFollow.busy,
            }
          : post,
      )
    : feed.posts;
  const toggleAuthorFollow = (userId: string) => {
    if (authorFollow && userId === authorFollow.userId) authorFollow.onToggle();
    else void feed.toggleFollow(userId);
  };
  return {
    posts: {
      posts,
      labels: POST_CARD_LABELS,
      loading: feed.loading,
      loadingText: copy.loading,
      emptyText: tagged ? copy.taggedEmpty : copy.empty,
      menuFor: feed.menuFor,
      onOpenMenu: feed.openMenu,
      onCloseMenu: feed.closeMenu,
      onAskDelete: feed.askDelete,
      onTogglePin: feed.togglePin,
      pinBusy: feed.pinBusy,
      onToggleBody: feed.toggleExpanded,
      onLike: feed.toggleLike,
      onRepost: feed.toggleRepost,
      onComment: feed.openComments,
      onSave: feed.toggleSave,
      onShare: feed.share,
      onGift: feed.openGift,
      onOpenMedia: feed.openMedia,
      onTogglePostAuthorFollow: toggleAuthorFollow,
      onRemoveTag: feed.removeTag,
      hasMore: feed.hasMore,
      loadingMore: feed.loadingMore,
      onLoadMore: feed.loadMore,
      loadMoreLabel: copy.loadMore,
    },
    postOverlays: {
      gift: feed.giftDialog,
      share: feed.shareDialog,
      comments: {
        open: feed.commentsFor !== null,
        comments: feed.comments,
        loading: feed.commentsLoading,
        error: feed.commentsError,
        hasMore: feed.commentsHasMore,
        onLoadMore: feed.loadMoreComments,
        draft: feed.commentDraft,
        onDraftChange: feed.setCommentDraft,
        mentions: feed.commentMentions,
        maxLength: COMMENT_BODY_MAX,
        canSubmit: feed.canComment,
        sending: feed.commentSending,
        onSubmit: feed.submitComment,
        onDelete: feed.deleteComment,
        onClose: feed.closeComments,
        viewerAvatarUrl,
        labels: {
          title: FEED_COPY.comments,
          empty: FEED_COPY.commentsEmpty,
          placeholder: FEED_COPY.commentPlaceholder,
          submit: FEED_COPY.commentSubmit,
          delete: FEED_COPY.commentDelete,
          loadMore: FEED_COPY.commentsMore,
          loading: FEED_COPY.loading,
          close: FEED_COPY.closeComments,
          mentions: FEED_COPY.mentionSuggestions,
          organization: FEED_COPY.organization,
          verifiedOrganization: FEED_COPY.verifiedOrganization,
        },
      },
      confirm: {
        open: feed.confirmDelete !== null,
        message: feed.confirmDeleteIsRepost
          ? FEED_COPY.removeRepostConfirm
          : FEED_COPY.deletePostConfirm,
        confirmLabel: feed.confirmDeleteIsRepost ? FEED_COPY.removeRepost : FEED_COPY.deletePost,
        cancelLabel: FEED_COPY.composerCancel,
        busy: feed.deleting,
        onConfirm: feed.confirmDeletePost,
        onCancel: feed.cancelDelete,
      },
      lightbox: {
        media: feed.lightbox,
        onClose: feed.closeMedia,
        closeLabel: FEED_COPY.composerCancel,
      },
      toast: { message: feed.shareNote, onDismiss: feed.dismissShareNote },
    },
  };
}
