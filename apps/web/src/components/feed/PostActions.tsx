import MaskIcon from "@/components/app/MaskIcon";

export interface PostActionLabels {
  like: string;
  unlike: string;
  comment: string;
  repost: string;
  unrepost: string;
  save: string;
  unsave: string;
  share: string;
}

export interface PostActionsProps {
  likes: string;
  comments: string;
  reposts: string;
  likedByMe: boolean;
  repostedByMe: boolean;
  savedByMe: boolean;
  onLike: () => void;
  onRepost: () => void;
  onComment: () => void;
  onSave: () => void;
  onShare: () => void;
  labels: PostActionLabels;
}

const ICON = 24;

/** The action row from the Figma card (831:136…831:166): like · repost · comment, then save and share pushed right. */
export default function PostActions({
  likes,
  comments,
  reposts,
  likedByMe,
  repostedByMe,
  savedByMe,
  onLike,
  onRepost,
  onComment,
  onSave,
  onShare,
  labels,
}: PostActionsProps) {
  /** Gold marks the actions the viewer has already taken, as the like does. */
  const action = (src: string, on: boolean, label: string, onClick: () => void, count?: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`flex items-center gap-[6px] text-[14px] font-medium transition-colors ${
        on ? "text-kink-gold-bright" : "text-feed-muted hover:text-feed-text"
      }`}
    >
      <MaskIcon src={src} width={ICON} />
      {count}
    </button>
  );

  return (
    <div className="flex items-center gap-[24px] pt-[14px] text-feed-muted">
      {action(
        "/app/feed/icon-like.svg",
        likedByMe,
        likedByMe ? labels.unlike : labels.like,
        onLike,
        likes,
      )}
      {action(
        "/app/feed/icon-repost.svg",
        repostedByMe,
        repostedByMe ? labels.unrepost : labels.repost,
        onRepost,
        reposts,
      )}
      <button
        type="button"
        onClick={onComment}
        aria-label={labels.comment}
        className="flex items-center gap-[6px] text-[14px] font-medium text-feed-muted transition-colors hover:text-feed-text"
      >
        <MaskIcon src="/app/feed/icon-comment.svg" width={ICON} />
        {comments}
      </button>

      <span className="flex-1" />

      {action(
        "/app/feed/icon-bookmark.svg",
        savedByMe,
        savedByMe ? labels.unsave : labels.save,
        onSave,
      )}
      <button
        type="button"
        onClick={onShare}
        aria-label={labels.share}
        className="text-feed-muted transition-colors hover:text-feed-text"
      >
        <MaskIcon src="/app/feed/icon-share.svg" width={ICON} />
      </button>
    </div>
  );
}
