"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { POST_TAGS_MAX, type TagSuggestionPM } from "@/domain/post";
import { postsApi } from "@/services/posts.service";

/** How long typing settles before the friends search runs. */
const SEARCH_DELAY_MS = 200;

/** The composer's "Tag" panel, display-ready. */
export interface TagPickerVM {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
  results: {
    userId: string;
    name: string;
    handle: string | null;
    avatarUrl: string | null;
    onPick: () => void;
  }[];
  loading: boolean;
  empty: boolean;
  /** Who's tagged so far, each removable. */
  chips: { userId: string; name: string; onRemove: () => void }[];
  /** Ten tagged: no more can be added. */
  full: boolean;
}

/**
 * Friends to tag in a new post (founder, 2026-10-21). Only friends are
 * offered, as only friends can be tagged; the API checks again on posting.
 * `enabled` is whether the composer is open, so nothing is searched behind it.
 */
export function useTagPicker(enabled: boolean) {
  const [selected, setSelected] = useState<TagSuggestionPM[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ key: string; items: TagSuggestionPM[] } | null>(null);
  // What the results should answer: the search as typed, while the panel is open.
  const key = enabled && open ? query.trim().toLowerCase() : null;

  useEffect(() => {
    if (key === null) return;
    let live = true;
    const timer = setTimeout(() => {
      postsApi.tagSuggestions(key).then(
        (res) => live && setFound({ key, items: res.items }),
        () => live && setFound({ key, items: [] }),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);

  const loading = key !== null && found?.key !== key;
  const add = useCallback((member: TagSuggestionPM) => {
    setSelected((cur) =>
      cur.length >= POST_TAGS_MAX || cur.some((m) => m.userId === member.userId)
        ? cur
        : [...cur, member],
    );
    setQuery("");
  }, []);
  const remove = useCallback((userId: string) => {
    setSelected((cur) => cur.filter((m) => m.userId !== userId));
  }, []);
  const reset = useCallback(() => {
    setSelected([]);
    setOpen(false);
    setQuery("");
  }, []);

  const vm = useMemo((): TagPickerVM => {
    const items = loading
      ? []
      : (found?.items ?? []).filter((m) => !selected.some((s) => s.userId === m.userId));
    return {
      open,
      onOpen: () => setOpen(true),
      onClose: () => setOpen(false),
      query,
      setQuery,
      results: items.map((m) => ({
        userId: m.userId,
        name: m.displayName,
        handle: m.username ? `@${m.username}` : null,
        avatarUrl: m.avatarUrl,
        onPick: () => add(m),
      })),
      loading,
      // Nobody matched; a friend already tagged isn't offered again, but isn't "no match" either.
      empty: open && !loading && (found?.items.length ?? 0) === 0,
      chips: selected.map((m) => ({
        userId: m.userId,
        name: m.displayName,
        onRemove: () => remove(m.userId),
      })),
      full: selected.length >= POST_TAGS_MAX,
    };
  }, [open, query, found, loading, selected, add, remove]);

  return {
    vm,
    /** What the new post sends: the tagged friends' usernames. */
    usernames: selected.flatMap((m) => (m.username ? [m.username] : [])),
    reset,
  };
}
