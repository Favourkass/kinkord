import type { PostMediaVM, PostVM } from "@/domain/post";
import PostCard, { type PostCardProps } from "@/components/feed/PostCard";

export interface PostsTabProps {
  posts: PostVM[];
  labels: PostCardProps["labels"];
  loading: boolean;
  loadingText: string;
  emptyText: string;
  menuFor: string | null;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
  onAskDelete: (id: string) => void;
  onToggleBody: (id: string) => void;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onOpenMedia: (media: PostMediaVM) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  loadMoreLabel: string;
}

/**
 * Posts tab (Figma 936:2281): the member's own posts, newest first.
 *
 * The cards are the feed's `PostCard`, so a post looks and behaves the same
 * wherever it is read. `feed-profile-tone` re-points the feed's colour tokens at
 * the profile palette, which is cooler in dark mode — one component, the
 * surface it happens to be sitting on.
 */
export default function PostsTab(p: PostsTabProps) {
  if (p.loading) {
    return (
      <p className="px-[16px] py-[40px] text-center text-[14px] text-pf-muted">{p.loadingText}</p>
    );
  }
  if (p.posts.length === 0) {
    return (
      <p className="px-[16px] py-[40px] text-center text-[14px] text-pf-muted">{p.emptyText}</p>
    );
  }
  return (
    <div className="feed-profile-tone mx-[14px] overflow-hidden rounded-[12px] border border-pf-border bg-pf-surface">
      {p.posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          labels={p.labels}
          menuOpen={p.menuFor === post.id}
          onMenu={() => p.onOpenMenu(post.id)}
          onCloseMenu={p.onCloseMenu}
          onDelete={() => p.onAskDelete(post.id)}
          onToggleBody={() => p.onToggleBody(post.id)}
          onLike={() => p.onLike(post.id)}
          onComment={() => p.onComment(post.id)}
          onOpenMedia={p.onOpenMedia}
        />
      ))}
      {p.hasMore && (
        <div className="px-[25px] py-[18px] text-center">
          <button
            type="button"
            onClick={p.onLoadMore}
            disabled={p.loadingMore}
            className="rounded-[8px] border border-pf-border px-[20px] py-[8px] text-[14px] font-medium text-pf-text disabled:opacity-50"
          >
            {p.loadingMore ? p.loadingText : p.loadMoreLabel}
          </button>
        </div>
      )}
    </div>
  );
}
