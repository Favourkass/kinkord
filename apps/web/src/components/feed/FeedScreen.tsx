import type { PostMediaVM, PostVM } from "@/domain/post";
import CommentsPanel, { type CommentsPanelProps } from "./CommentsPanel";
import ComposerBar, { type ComposerBarProps } from "./ComposerBar";
import ComposerDialog, { type ComposerDialogProps } from "./ComposerDialog";
import ConfirmDialog, { type ConfirmDialogProps } from "./ConfirmDialog";
import FeedShell, { type FeedShellProps } from "./FeedShell";
import MediaLightbox, { type MediaLightboxProps } from "./MediaLightbox";
import PeopleYouMayKnow, { type PeopleYouMayKnowProps } from "./PeopleYouMayKnow";
import PostCard, { type PostCardProps } from "./PostCard";
import Toast, { type ToastProps } from "./Toast";

export interface FeedScreenProps {
  shell: Omit<FeedShellProps, "aside" | "children">;
  loading: boolean;
  error: string | null;
  posts: PostVM[];
  postLabels: PostCardProps["labels"];
  menuFor: string | null;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
  onAskDelete: (id: string) => void;
  onToggleBody: (id: string) => void;
  /** Reactions target `post.postId`: acting on a repost acts on the post it points at. */
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
  onComment: (postId: string) => void;
  onSave: (postId: string) => void;
  onShare: (postId: string) => void;
  onOpenMedia: (media: PostMediaVM) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  composerBar: ComposerBarProps;
  composerDialog: ComposerDialogProps;
  commentsPanel: CommentsPanelProps;
  people: PeopleYouMayKnowProps;
  lightbox: MediaLightboxProps;
  confirm: ConfirmDialogProps;
  toast: ToastProps;
  copy: {
    emptyTitle: string;
    emptyBody: string;
    loading: string;
    loadMore: string;
    asideHeading: string;
    asideTagline: string;
  };
}

/**
 * The home feed (Figma "Hompage Light" 344:138 / dark 837:295).
 *
 * On a phone the suggestions strip sits between the first and second post, as
 * drawn. On desktop it moves to the right rail and the same cards stack there,
 * so nothing in the design is lost and nothing is invented for the wide layout.
 */
export default function FeedScreen(p: FeedScreenProps) {
  const card = (post: PostVM) => (
    <PostCard
      key={post.id}
      post={post}
      labels={p.postLabels}
      menuOpen={p.menuFor === post.id}
      onMenu={() => p.onOpenMenu(post.id)}
      onCloseMenu={p.onCloseMenu}
      onDelete={() => p.onAskDelete(post.id)}
      onToggleBody={() => p.onToggleBody(post.id)}
      onLike={() => p.onLike(post.postId)}
      onRepost={() => p.onRepost(post.postId)}
      onComment={() => p.onComment(post.postId)}
      onSave={() => p.onSave(post.postId)}
      onShare={() => p.onShare(post.postId)}
      onOpenMedia={p.onOpenMedia}
    />
  );

  return (
    <>
      <FeedShell
        {...p.shell}
        aside={
          <>
            <PeopleYouMayKnow {...p.people} layout="column" />
            <section className="rounded-[16px] border border-feed-line bg-feed-card p-[16px]">
              <p className="text-[14px] font-bold tracking-[1.4px] text-kink-gold-bright">
                {p.copy.asideHeading}
              </p>
              <p className="pt-[4px] text-[12px] text-feed-muted">{p.copy.asideTagline}</p>
            </section>
          </>
        }
      >
        <ComposerBar {...p.composerBar} />

        {p.error && (
          <p className="px-[25px] py-[40px] text-center text-[15px] font-semibold text-feed-muted">
            {p.error}
          </p>
        )}

        {p.loading && !p.error && (
          <p className="px-[25px] py-[40px] text-center text-[14px] text-feed-muted">
            {p.copy.loading}
          </p>
        )}

        {!p.loading && !p.error && p.posts.length === 0 && (
          <div className="px-[25px] py-[48px] text-center">
            <p className="text-[16px] font-bold text-feed-text">{p.copy.emptyTitle}</p>
            <p className="pt-[6px] text-[14px] text-feed-muted">{p.copy.emptyBody}</p>
          </div>
        )}

        {p.posts.slice(0, 1).map(card)}
        {/* The design puts the suggestions between the first and second post. */}
        <div className="lg:hidden">
          <PeopleYouMayKnow {...p.people} />
        </div>
        {p.posts.slice(1).map(card)}

        {p.hasMore && (
          <div className="px-[25px] py-[20px] text-center">
            <button
              type="button"
              onClick={p.onLoadMore}
              disabled={p.loadingMore}
              className="rounded-[8px] border border-feed-line px-[20px] py-[8px] text-[14px] font-medium text-feed-text disabled:opacity-50"
            >
              {p.loadingMore ? p.copy.loading : p.copy.loadMore}
            </button>
          </div>
        )}
      </FeedShell>

      <ComposerDialog {...p.composerDialog} />
      <CommentsPanel {...p.commentsPanel} />
      <MediaLightbox {...p.lightbox} />
      <ConfirmDialog {...p.confirm} />
      <Toast {...p.toast} />
    </>
  );
}
