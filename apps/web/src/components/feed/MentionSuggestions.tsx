import AvatarCircle from "@/components/app/AvatarCircle";
import SilverCheck from "@/components/app/SilverCheck";

export interface MentionSuggestionsProps {
  open: boolean;
  items: Array<{
    userId: string;
    username: string;
    name: string;
    avatarUrl: string | null;
    silver: boolean;
  }>;
  highlighted: number;
  onPick: (username: string) => void;
  /**
   * Above the box (a comment box at the foot of the screen), or inline under it
   * (the composer, a scrolling sheet that would clip a list floating over it).
   */
  placement: "above" | "inline";
  label: string;
}

/** "@" suggestions for a box: shown by MentionSuggestions, keys offered first, caret after a pick. */
export type MentionPickerProps = Omit<MentionSuggestionsProps, "placement" | "label"> & {
  /** True when the key was the list's: the box leaves it alone then. */
  onKey: (key: string) => boolean;
  /** Where the caret goes after a pick; a new `pick` each time. */
  caret: { at: number; pick: number } | null;
};

/** Members to mention, while "@" and a few letters are typed. */
export default function MentionSuggestions(p: MentionSuggestionsProps) {
  if (!p.open) return null;
  return (
    <ul
      role="listbox"
      aria-label={p.label}
      className={`max-h-[264px] overflow-y-auto rounded-[12px] border border-feed-line bg-feed-card py-[4px] ${
        p.placement === "above"
          ? "absolute bottom-full left-0 right-0 z-30 mb-[6px] shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          : "mt-[8px]"
      }`}
    >
      {p.items.map((s, i) => (
        <li key={s.userId} role="option" aria-selected={i === p.highlighted}>
          <button
            type="button"
            // Before the box loses focus, so the pick lands in it.
            onMouseDown={(e) => {
              e.preventDefault();
              p.onPick(s.username);
            }}
            className={`flex w-full items-center gap-[10px] px-[12px] py-[8px] text-left ${
              i === p.highlighted ? "bg-feed-chip" : ""
            }`}
          >
            <AvatarCircle src={s.avatarUrl} alt="" size={28} />
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-[4px] text-[14px] font-bold text-feed-text">
                <span className="truncate">{s.name}</span>
                {s.silver ? <SilverCheck size={13} /> : null}
              </span>
              <span className="block truncate text-[12px] text-feed-muted">@{s.username}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
