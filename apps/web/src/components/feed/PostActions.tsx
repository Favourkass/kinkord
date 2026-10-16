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
  gift: string;
  coin: string;
  star: string;
  crown: string;
}

export interface PostActionsProps {
  canReceiveGift: boolean;
  likes: string;
  shares: string;
  gifts: string;
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
  onGift: (currency?: "coin" | "star" | "crown") => void;
  labels: PostActionLabels;
}

const ICON = 18;
const BASE =
  "flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-medium transition-colors hover:text-kink-gold-bright focus-visible:outline-2 focus-visible:outline-kink-gold-bright";
const ACTION = `${BASE} bg-feed-line/40 text-feed-text`;
/** A like already given: gold, so it reads as done (and tapping undoes it). */
const PRESSED = `${BASE} bg-kink-gold-bright/20 text-kink-gold-bright`;
const GOLD = "text-kink-gold-bright drop-shadow-[0_1px_1px_rgba(190,128,0,0.45)]";

/** Four compact timeline actions; currency selection stays inside the gift picker. */
export default function PostActions({
  canReceiveGift,
  likes,
  shares,
  gifts,
  comments,
  likedByMe,
  onLike,
  onComment,
  onShare,
  onGift,
  labels,
}: PostActionsProps) {
  return (
    <div className="pt-2">
      <div className={`grid gap-2 ${canReceiveGift ? "grid-cols-4" : "grid-cols-3"}`}>
        <button
          type="button"
          onClick={onLike}
          aria-pressed={likedByMe}
          aria-label={`${likedByMe ? labels.unlike : labels.like} (${likes})`}
          className={likedByMe ? PRESSED : ACTION}
        >
          <MaskIcon src="/app/feed/icon-like.svg" width={ICON} className={GOLD} />
          <span className="tabular-nums">{likes}</span>
        </button>
        <button
          type="button"
          onClick={onComment}
          aria-label={`${labels.comment} (${comments})`}
          className={ACTION}
        >
          <MaskIcon src="/app/feed/icon-comment.svg" width={ICON} className={GOLD} />
          <span className="tabular-nums">{comments}</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label={`${labels.share} (${shares})`}
          className={ACTION}
        >
          <MaskIcon src="/app/feed/icon-share.svg" width={ICON} className={GOLD} />
          <span className="tabular-nums">{shares}</span>
        </button>
        {canReceiveGift && (
          <button
            type="button"
            onClick={() => onGift()}
            aria-label={`${labels.gift} (${gifts})`}
            className={ACTION}
          >
            <span aria-hidden="true" className="shrink-0 text-[18px] leading-none">
              🎁
            </span>
            <span className="tabular-nums">{gifts}</span>
          </button>
        )}
      </div>
    </div>
  );
}
