import { FEED_COPY, POST_CARD_LABELS } from "@/constants/feed";
import { MEMBERS_COPY } from "@/constants/members";
import { COMMENT_BODY_MAX } from "@/domain/post";
import type { useFeedPresenter } from "./useFeedPresenter";

type Feed = ReturnType<typeof useFeedPresenter>;

/**
 * Turns a feed pointed at one member into the Posts tab's props plus its three
 * overlays. Both /profile and /u/[username] render the same tab, so the wiring
 * lives here rather than being copied into each page.
 *
 * Deliberately returns a plain shape: presenters may not import from
 * `components/`, and the page's call site type-checks it against
 * `ProfileScreenProps` anyway.
 */
export function getProfilePosts(feed: Feed, viewerAvatarUrl: string | null) {
  const copy = MEMBERS_COPY.profile.posts;
  return {
    posts: {
      posts: feed.posts,
      labels: POST_CARD_LABELS,
      loading: feed.loading,
      loadingText: copy.loading,
      emptyText: copy.empty,
      menuFor: feed.menuFor,
      onOpenMenu: feed.openMenu,
      onCloseMenu: feed.closeMenu,
      onAskDelete: feed.askDelete,
      onToggleBody: feed.toggleExpanded,
      onLike: feed.toggleLike,
      onRepost: feed.toggleRepost,
      onComment: feed.openComments,
      onSave: feed.toggleSave,
      onShare: feed.share,
      onOpenMedia: feed.openMedia,
      hasMore: feed.hasMore,
      loadingMore: feed.loadingMore,
      onLoadMore: feed.loadMore,
      loadMoreLabel: copy.loadMore,
    },
    postOverlays: {
      comments: {
        open: feed.commentsFor !== null,
        comments: feed.comments,
        loading: feed.commentsLoading,
        error: feed.commentsError,
        hasMore: feed.commentsHasMore,
        onLoadMore: feed.loadMoreComments,
        draft: feed.commentDraft,
        onDraftChange: feed.setCommentDraft,
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
        },
      },
      confirm: {
        open: feed.confirmDelete !== null,
        message: FEED_COPY.deletePostConfirm,
        confirmLabel: FEED_COPY.deletePost,
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
