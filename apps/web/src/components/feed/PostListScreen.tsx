import type { PostMediaVM, PostVM } from "@/domain/post";
import CommentsPanel, { type CommentsPanelProps } from "./CommentsPanel";
import ConfirmDialog, { type ConfirmDialogProps } from "./ConfirmDialog";
import FeedShell, { type FeedShellProps } from "./FeedShell";
import MediaLightbox, { type MediaLightboxProps } from "./MediaLightbox";
import PostCard, { type PostCardProps } from "./PostCard";
import Toast, { type ToastProps } from "./Toast";

export interface PostListScreenProps {
  shell: Omit<FeedShellProps, "aside" | "children">;
  heading: string;
  loading: boolean;
  error: string | null;
  posts: PostVM[];
  postLabels: PostCardProps["labels"];
  menuFor: string | null;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
  onAskDelete: (id: string) => void;
  onToggleBody: (id: string) => void;
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
  onComment: (postId: string) => void;
  onSave: (postId: string) => void;
  onShare: (postId: string) => void;
  onOpenMedia: (media: PostMediaVM) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  commentsPanel: CommentsPanelProps;
  lightbox: MediaLightboxProps;
  confirm: ConfirmDialogProps;
  toast: ToastProps;
  copy: { empty: string; loading: string; loadMore: string };
}

/**
 * A plain list of posts in the app chrome: one post on its own (a shared link)
 * and the saved list. Same shell and same card as the feed, without the
 * composer or the suggestions strip, neither of which belongs on either screen.
 */
export default function PostListScreen(p: PostListScreenProps) {
  return (
    <>
      <FeedShell {...p.shell} aside={null}>
        <h1 className="border-b border-feed-line px-[25px] py-[18px] text-[18px] font-bold text-feed-text">
          {p.heading}
        </h1>

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
          <p className="px-[25px] py-[48px] text-center text-[14px] text-feed-muted">
            {p.copy.empty}
          </p>
        )}

        {p.posts.map((post) => (
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
        ))}

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

      <CommentsPanel {...p.commentsPanel} />
      <MediaLightbox {...p.lightbox} />
      <ConfirmDialog {...p.confirm} />
      <Toast {...p.toast} />
    </>
  );
}
