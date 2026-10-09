"use client";

import { useEffect, useRef } from "react";
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
  label: string;
  /** Spacing from the box: the list sits in the page's flow, where no sheet can clip it. */
  className?: string;
}

/** "@" suggestions for a box: shown by MentionSuggestions, keys offered first, caret after a pick. */
export type MentionPickerProps = Omit<MentionSuggestionsProps, "label" | "className"> & {
  /** True when the key was the list's: the box leaves it alone then. */
  onKey: (key: string) => boolean;
  /** Where the caret goes after a pick; a new `pick` each time. */
  caret: { at: number; pick: number } | null;
};

/** Members to mention, while "@" and a few letters are typed. */
export default function MentionSuggestions(p: MentionSuggestionsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  // The arrows move the highlight while the box keeps its focus: keep that row in sight.
  useEffect(() => {
    listRef.current?.children[p.highlighted]?.scrollIntoView({ block: "nearest" });
  }, [p.highlighted]);

  if (!p.open) return null;
  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={p.label}
      className={`max-h-[208px] overflow-y-auto rounded-[12px] border border-feed-line bg-feed-card py-[4px] ${p.className ?? ""}`}
    >
      {p.items.map((s, i) => (
        <li key={s.userId} role="option" aria-selected={i === p.highlighted}>
          <button
            type="button"
            // The box keeps its focus (and caret) through the press; the pick is the click,
            // so a keyboard or a screen reader can pick too.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => p.onPick(s.username)}
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
