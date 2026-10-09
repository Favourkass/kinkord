"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import AvatarCircle from "@/components/app/AvatarCircle";
import SilverCheck from "@/components/app/SilverCheck";

export interface MentionSuggestionsProps {
  /** The list's id: the box points at it, and at the highlighted member's row. */
  id: string;
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
export type MentionPickerProps = Omit<MentionSuggestionsProps, "id" | "label" | "className"> & {
  /** True when the key was the list's: the box leaves it alone then. */
  onKey: (key: string) => boolean;
  /** Where the caret goes after a pick; a new `pick` each time. */
  caret: { at: number; pick: number } | null;
};

const optionId = (listId: string, userId: string) => `${listId}-${userId}`;

/**
 * A key that's part of an IME composition (choosing characters, or the Enter
 * that ends one): the keyboard's, never the list's or the box's. Safari sends
 * that Enter once the composition has ended, flagged only by keyCode 229.
 */
export function composing(e: KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

/**
 * The highlighted member's row, for the box's aria-activedescendant: focus
 * stays in the box, so this is how a screen reader hears whom Enter would pick.
 */
export function activeMentionId(listId: string, m: MentionPickerProps): string | undefined {
  const active = m.open ? m.items[m.highlighted] : undefined;
  return active ? optionId(listId, active.userId) : undefined;
}

/** Members to mention, while "@" and a few letters are typed. */
export default function MentionSuggestions(p: MentionSuggestionsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  // The arrows move the highlight while the box keeps its focus: keep that row in sight.
  useEffect(() => {
    listRef.current?.children[p.highlighted]?.scrollIntoView({ block: "nearest" });
  }, [p.highlighted]);

  // Always there (hidden while closed), so the box's aria-controls always finds it.
  return (
    <ul
      ref={listRef}
      id={p.id}
      role="listbox"
      aria-label={p.label}
      hidden={!p.open}
      className={`max-h-[208px] overflow-y-auto rounded-[12px] border border-feed-line bg-feed-card py-[4px] ${p.className ?? ""}`}
    >
      {p.items.map((s, i) => (
        <li
          key={s.userId}
          id={optionId(p.id, s.userId)}
          role="option"
          aria-selected={i === p.highlighted}
          // The box keeps its focus (and caret) through the press; the pick is the click,
          // which a screen reader's activation sends too.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => p.onPick(s.username)}
          className={`flex cursor-pointer items-center gap-[10px] px-[12px] py-[8px] ${
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
        </li>
      ))}
    </ul>
  );
}
