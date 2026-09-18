import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";
import type { PostMediaVM, PostVM } from "@/domain/post";
import PostActions, { type PostActionLabels } from "./PostActions";
import PostMediaGrid from "./PostMediaGrid";

export interface PostCardProps {
  post: PostVM;
  labels: PostActionLabels & {
    more: string;
    less: string;
    menu: string;
    delete: string;
    /** "Favour reposted", above a repost. */
    repostedBy: (name: string) => string;
  };
  /** Open when this card's overflow menu is showing. */
  menuOpen: boolean;
  onMenu: () => void;
  onCloseMenu: () => void;
  onDelete: () => void;
  onToggleBody: () => void;
  onLike: () => void;
  onRepost: () => void;
  onComment: () => void;
  onSave: () => void;
  onShare: () => void;
  onOpenMedia: (media: PostMediaVM) => void;
}

/**
 * One post (Figma 830:133–831:166): 35px avatar on the designer's blue ring,
 * name + handle on one line with the age of the post beneath, overflow menu top
 * right, then the body, the photos and the action row.
 */
export default function PostCard({
  post,
  labels,
  menuOpen,
  onMenu,
  onCloseMenu,
  onDelete,
  onToggleBody,
  onLike,
  onRepost,
  onComment,
  onSave,
  onShare,
  onOpenMedia,
}: PostCardProps) {
  const name = (
    <span className="text-[14px] font-bold leading-[17px] text-feed-text">{post.authorName}</span>
  );
  return (
    <article className="border-b border-feed-line px-[25px] py-[18px]">
      {post.repostedByName && (
        <p className="flex items-center gap-[8px] pb-[10px] pl-[2px] text-[12px] font-medium text-feed-muted">
          <MaskIcon src="/app/feed/icon-repost.svg" width={14} />
          {labels.repostedBy(post.repostedByName)}
        </p>
      )}
      <header className="flex items-start gap-[12px]">
        <AvatarCircle src={post.avatarUrl} alt="" size={35} ringClassName="bg-[#4285f4]" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-[8px]">
            {post.authorHref ? (
              <Link href={post.authorHref} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
            {post.handle && (
              <span className="text-[12px] font-light leading-[15px] text-feed-muted">
                {post.handle}
              </span>
            )}
          </p>
          <p className="flex items-center gap-[8px] pt-[2px] text-[12px] font-light leading-[15px] text-feed-muted">
            {post.time}
            {post.visibilityNote && <span>· {post.visibilityNote}</span>}
          </p>
        </div>
        {post.mine && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label={labels.menu}
              aria-expanded={menuOpen}
              onClick={menuOpen ? onCloseMenu : onMenu}
              className="text-feed-muted transition-colors hover:text-feed-text"
            >
              <MaskIcon src="/app/feed/icon-dots.svg" width={20} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[26px] z-10 min-w-[160px] overflow-hidden rounded-[10px] border border-feed-line bg-feed-sheet shadow-lg">
                <button
                  type="button"
                  onClick={onDelete}
                  className="block w-full px-[14px] py-[10px] text-left text-[13px] font-medium text-[#e5484d]"
                >
                  {labels.delete}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {post.body && (
        <p className="whitespace-pre-wrap pt-[12px] text-[14px] font-medium leading-[20px] text-feed-text">
          {post.body}{" "}
          {post.canExpand && (
            <button
              type="button"
              onClick={onToggleBody}
              className="text-[14px] font-medium text-feed-muted hover:underline"
            >
              {post.expanded ? labels.less : labels.more}
            </button>
          )}
        </p>
      )}

      <PostMediaGrid media={post.media} onOpen={onOpenMedia} />

      <PostActions
        likes={post.likes}
        comments={post.comments}
        reposts={post.reposts}
        likedByMe={post.likedByMe}
        repostedByMe={post.repostedByMe}
        savedByMe={post.savedByMe}
        onLike={onLike}
        onRepost={onRepost}
        onComment={onComment}
        onSave={onSave}
        onShare={onShare}
        labels={labels}
      />
    </article>
  );
}
