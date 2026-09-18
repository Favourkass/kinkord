import MaskIcon from "@/components/app/MaskIcon";

export interface PostActionLabels {
  like: string;
  unlike: string;
  comment: string;
  repost: string;
  save: string;
  share: string;
  /** Announced on the controls that have no backend yet. */
  comingSoon: string;
}

export interface PostActionsProps {
  likes: string;
  comments: string;
  likedByMe: boolean;
  onLike: () => void;
  onComment: () => void;
  labels: PostActionLabels;
}

const ICON = 24;

/**
 * The action row from the Figma card (831:136…831:166): like · repost · comment,
 * then save and share pushed right.
 *
 * Repost, save and share are drawn but inert — none of the three has an API
 * behind it yet, so they carry the same dimmed "coming soon" treatment the
 * footer gives an unlaunched channel rather than looking tappable and doing
 * nothing.
 */
export default function PostActions({
  likes,
  comments,
  likedByMe,
  onLike,
  onComment,
  labels,
}: PostActionsProps) {
  const soon = (src: string, label: string) => (
    <span aria-label={`${label} — ${labels.comingSoon}`} role="img" className="opacity-40">
      <MaskIcon src={src} width={ICON} />
    </span>
  );
  return (
    <div className="flex items-center gap-[24px] pt-[14px] text-feed-muted">
      <button
        type="button"
        onClick={onLike}
        aria-pressed={likedByMe}
        aria-label={likedByMe ? labels.unlike : labels.like}
        className={`flex items-center gap-[6px] text-[14px] font-medium transition-colors ${
          likedByMe ? "text-kink-gold-bright" : "text-feed-muted hover:text-feed-text"
        }`}
      >
        <MaskIcon src="/app/feed/icon-like.svg" width={ICON} />
        {likes}
      </button>

      {soon("/app/feed/icon-repost.svg", labels.repost)}

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

      {soon("/app/feed/icon-bookmark.svg", labels.save)}
      {soon("/app/feed/icon-share.svg", labels.share)}
    </div>
  );
}
