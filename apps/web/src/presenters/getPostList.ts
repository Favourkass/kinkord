import { FEED_COPY, POST_CARD_LABELS } from "@/constants/feed";
import { COMMENT_BODY_MAX } from "@/domain/post";
import type { useFeedPresenter } from "./useFeedPresenter";

type Feed = ReturnType<typeof useFeedPresenter>;

/**
 * Turns a feed into a plain post list plus its overlays, for the screens that
 * show posts without a composer: a shared link and the saved list. The home
 * feed and the profile Posts tab have their own builders because they wrap the
 * same cards in different chrome.
 */
export function getPostList(feed: Feed, viewerAvatarUrl: string | null) {
  return {
    loading: feed.loading,
    error: feed.error,
    posts: feed.posts,
    postLabels: POST_CARD_LABELS,
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
    commentsPanel: {
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
    lightbox: {
      media: feed.lightbox,
      onClose: feed.closeMedia,
      closeLabel: FEED_COPY.composerCancel,
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
    toast: { message: feed.shareNote, onDismiss: feed.dismissShareNote },
  };
}
