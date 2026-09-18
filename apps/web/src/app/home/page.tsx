"use client";

import FeedScreen from "@/components/feed/FeedScreen";
import { FEED_COPY, FEED_VISIBILITIES } from "@/constants/feed";
import { Routes } from "@/constants/Routes";
import { COMMENT_BODY_MAX, POST_BODY_MAX } from "@/domain/post";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useFeedPresenter } from "@/presenters/useFeedPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** Post-login home: the feed (Figma "Hompage Light" 344:138 / dark 837:295). */
export default function HomePage() {
  const home = useHomePresenter();
  const feed = useFeedPresenter();
  const nav = getAppShellNav();

  return (
    <FeedScreen
      shell={{
        brand: "KINKORD",
        greeting: home.greeting,
        name: home.name,
        avatarUrl: home.avatarUrl,
        membersCount: home.membersCount,
        drawerOpen: home.drawerOpen,
        onMenu: home.openDrawer,
        onCloseDrawer: home.closeDrawer,
        onLogout: home.logout,
        links: nav.links,
        labels: nav.labels,
      }}
      loading={feed.loading}
      error={home.error ?? feed.error}
      posts={feed.posts}
      postLabels={{
        like: FEED_COPY.like,
        unlike: FEED_COPY.unlike,
        comment: FEED_COPY.comment,
        repost: FEED_COPY.repost,
        save: FEED_COPY.save,
        share: FEED_COPY.share,
        comingSoon: FEED_COPY.comingSoon,
        more: FEED_COPY.more,
        less: FEED_COPY.less,
        menu: FEED_COPY.postMenu,
        delete: FEED_COPY.deletePost,
      }}
      menuFor={feed.menuFor}
      onOpenMenu={feed.openMenu}
      onCloseMenu={feed.closeMenu}
      onAskDelete={feed.askDelete}
      onToggleBody={feed.toggleExpanded}
      onLike={feed.toggleLike}
      onComment={feed.openComments}
      onOpenMedia={feed.openMedia}
      hasMore={feed.hasMore}
      loadingMore={feed.loadingMore}
      onLoadMore={feed.loadMore}
      composerBar={{
        avatarUrl: home.avatarUrl,
        placeholder: FEED_COPY.composerPlaceholder,
        openLabel: FEED_COPY.composerOpen,
        photoLabel: FEED_COPY.addPhoto,
        onOpen: feed.openComposer,
        onOpenWithPhoto: feed.openComposerWithPhoto,
      }}
      composerDialog={{
        open: feed.composerOpen,
        autoPickPhoto: feed.autoPickPhoto,
        authorName: home.name,
        avatarUrl: home.avatarUrl,
        draft: feed.draft,
        onDraftChange: feed.setDraft,
        maxLength: POST_BODY_MAX,
        visibility: feed.visibility,
        visibilities: FEED_VISIBILITIES,
        onVisibilityChange: (v) => feed.setVisibility(v === "friends" ? "friends" : "public"),
        photos: feed.photos,
        photoSlots: feed.photoSlots,
        onAddPhotos: feed.addPhotos,
        onRemovePhoto: feed.removePhoto,
        error: feed.composerError,
        posting: feed.posting,
        canPost: feed.canPost,
        onSubmit: feed.submitPost,
        onClose: feed.closeComposer,
        labels: {
          title: FEED_COPY.composerTitle,
          submit: FEED_COPY.composerSubmit,
          posting: FEED_COPY.composerPosting,
          cancel: FEED_COPY.composerCancel,
          addPhoto: FEED_COPY.addPhotoShort,
          removePhoto: FEED_COPY.removePhoto,
          placeholder: FEED_COPY.composerPlaceholder,
          visibilityLabel: FEED_COPY.visibilityLabel,
        },
      }}
      commentsPanel={{
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
        viewerAvatarUrl: home.avatarUrl,
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
      }}
      people={{
        heading: FEED_COPY.peopleHeading,
        people: feed.suggestions,
        addLabel: FEED_COPY.peopleAdd,
        addedLabel: FEED_COPY.peopleAdded,
        seeAllLabel: FEED_COPY.peopleSeeAll,
        seeAllHref: Routes.members,
        dismissLabel: FEED_COPY.peopleDismiss,
        onDismiss: feed.hideSuggestions,
        onToggleFollow: feed.toggleFollow,
      }}
      lightbox={{
        media: feed.lightbox,
        onClose: feed.closeMedia,
        closeLabel: FEED_COPY.composerCancel,
      }}
      confirm={{
        open: feed.confirmDelete !== null,
        message: FEED_COPY.deletePostConfirm,
        confirmLabel: FEED_COPY.deletePost,
        cancelLabel: FEED_COPY.composerCancel,
        busy: feed.deleting,
        onConfirm: feed.confirmDeletePost,
        onCancel: feed.cancelDelete,
      }}
      copy={{
        emptyTitle: FEED_COPY.feedEmptyTitle,
        emptyBody: FEED_COPY.feedEmptyBody,
        loading: FEED_COPY.loading,
        loadMore: FEED_COPY.loadMore,
        asideHeading: FEED_COPY.asideHeading,
        asideTagline: FEED_COPY.asideTagline,
      }}
    />
  );
}
