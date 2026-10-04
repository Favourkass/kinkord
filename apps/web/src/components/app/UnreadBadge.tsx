export interface UnreadBadgeProps {
  count: number;
  /** Where it sits on its icon, and a ring in the colour behind it. */
  className: string;
}

/** Gold unread count on a navigation icon, hidden at zero. The link's label says it aloud. */
export default function UnreadBadge({ count, className }: UnreadBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={`absolute grid h-[18px] min-w-[18px] place-items-center rounded-full bg-kink-gold-bright px-1 text-[10px] font-bold leading-none text-black ring-2 ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
