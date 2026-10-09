import type { PostMediaVM, PostVM } from "@/domain/post";
import PostCard, { type PostCardProps } from "./PostCard";

export interface PostListProps {
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
  copy: { empty: string; loading: string; loadMore: string };
}

/** Posts as the feed shows them, with loading, empty and "more": a saved list, a shared post, a search. */
export default function PostList(p: PostListProps) {
  return (
    <>
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

      {/* While another list loads, the old one's posts don't belong on screen. */}
      {!p.loading &&
        p.posts.map((post) => (
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
    </>
  );
}
