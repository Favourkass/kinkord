"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  insertMention,
  mentionAt,
  toMentionSuggestionVM,
  type MentionAt,
  type MentionSuggestionVM,
} from "@/domain/mentions";
import { membersApi } from "@/services/members.service";

/** How long typing pauses before members are suggested. */
export const MENTION_DELAY_MS = 150;
const SUGGESTIONS = 6;

/** Which box is being typed in: the post composer or the comment box. */
export type MentionField = "post" | "comment";

/** What a box needs to show and work its suggestions. */
export interface MentionPickerVM {
  open: boolean;
  items: MentionSuggestionVM[];
  highlighted: number;
  onPick: (username: string) => void;
  /** True when the key was the list's (arrows, Enter, Tab, Escape): the box leaves it alone then. */
  onKey: (key: string) => boolean;
  /** Where to put the caret after a pick; changes with every pick. */
  caret: { at: number; pick: number } | null;
}

/**
 * Suggests members while "@" and a few letters are typed in the post composer
 * or a comment, best matches first, and swaps the "@que" for "@username " when
 * one is picked. Arrows move through the list, Enter or Tab pick, Escape
 * closes it. `setText` is how the picked text reaches the box's draft.
 */
export function useMentionSuggestions(setText: (field: MentionField, text: string) => void) {
  const [typing, setTyping] = useState<(MentionAt & { field: MentionField; text: string }) | null>(
    null,
  );
  const [found, setFound] = useState<{ query: string; items: MentionSuggestionVM[] } | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [caret, setCaret] = useState<{ field: MentionField; at: number; pick: number } | null>(
    null,
  );

  const query = typing?.query ?? "";
  useEffect(() => {
    if (!query) return;
    let live = true;
    const t = setTimeout(() => {
      membersApi.search(query, 1, SUGGESTIONS).then(
        (res) => {
          if (!live) return;
          const items = res.items
            .map(toMentionSuggestionVM)
            .filter((s): s is MentionSuggestionVM => s !== null);
          setFound({ query, items });
        },
        // Suggestions are a help, not a must: without them the handle is typed out.
        () => undefined,
      );
    }, MENTION_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const items = useMemo(
    () => (typing && found?.query === typing.query ? found.items : []),
    [typing, found],
  );

  /** Follows the box as it's typed in or its caret moves. */
  const track = useCallback((field: MentionField, text: string, at: number) => {
    const m = mentionAt(text, at);
    setTyping(m ? { ...m, field, text } : null);
    setHighlighted(0);
  }, []);

  const pick = useCallback(
    (field: MentionField, username: string, maxLength: number) => {
      if (!typing || typing.field !== field) return;
      const next = insertMention(typing.text, typing, username);
      setTyping(null);
      // Past the box's limit, the post or comment couldn't be sent: the pick is left out.
      if (next.text.length > maxLength) return;
      setText(field, next.text);
      setCaret((prev) => ({ field, at: next.caret, pick: (prev?.pick ?? 0) + 1 }));
    },
    [typing, setText],
  );

  /** The box's suggestions, picks kept within its `maxLength`. */
  const picker = useCallback(
    (field: MentionField, maxLength: number): MentionPickerVM => {
      const open = typing?.field === field && items.length > 0;
      return {
        open,
        items: open ? items : [],
        highlighted,
        onPick: (username) => pick(field, username, maxLength),
        onKey: (key) => {
          if (!open) return false;
          if (key === "ArrowDown") setHighlighted((h) => (h + 1) % items.length);
          else if (key === "ArrowUp") setHighlighted((h) => (h - 1 + items.length) % items.length);
          else if (key === "Enter" || key === "Tab")
            pick(field, items[highlighted].username, maxLength);
          else if (key === "Escape") setTyping(null);
          else return false;
          return true;
        },
        caret: caret?.field === field ? { at: caret.at, pick: caret.pick } : null,
      };
    },
    [typing, items, highlighted, pick, caret],
  );

  /** The box's draft was cleared (sent, or its sheet closed): nothing of it is left to pick into. */
  const close = useCallback(
    (field: MentionField) => setTyping((t) => (t?.field === field ? null : t)),
    [],
  );

  return { track, picker, close };
}
