import { MessageSquare, Share2, ThumbsUp } from "lucide-react";

export interface PostsTabProps {
  authorName: string;
  authorAvatarUrl: string | null;
  emptyText: string;
  labels: { like: string; comment: string; share: string };
}

/**
 * Figma Posts tab (936:2281): stacked post cards inside a bordered container.
 * Posts don't exist yet, so the first card carries the empty state in the same style.
 */
export default function PostsTab({
  authorName,
  authorAvatarUrl,
  emptyText,
  labels,
}: PostsTabProps) {
  const action = (Icon: typeof ThumbsUp, label: string) => (
    <span className="flex items-center gap-[6px] text-[12px] font-medium leading-[16px] text-pf-post-muted">
      <Icon size={14} strokeWidth={2} aria-hidden />
      {label}
    </span>
  );
  return (
    <div className="mx-[14px] overflow-hidden rounded-[12px] border border-pf-border bg-pf-surface">
      <article className="rounded-[12px] border-[1.5px] border-pf-post-border bg-pf-surface p-[16px]">
        <div className="flex items-center gap-[12px]">
          <span className="block size-[36px] overflow-hidden rounded-full bg-pf-surface-2">
            {authorAvatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={authorAvatarUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            )}
          </span>
          <span className="text-[14px] font-semibold leading-[20px] text-pf-text">
            {authorName}
          </span>
        </div>
        <p className="pt-[12px] text-[14px] leading-[20px] text-pf-post-text">{emptyText}</p>
        <div className="mt-[12px] flex gap-[16px] border-t-[1.5px] border-white/[0.04] pt-[8px]">
          {action(ThumbsUp, labels.like)}
          {action(MessageSquare, labels.comment)}
          {action(Share2, labels.share)}
        </div>
      </article>
    </div>
  );
}
