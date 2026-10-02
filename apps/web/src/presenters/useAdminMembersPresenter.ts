"use client";

import { useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { toAdminMemberRowVM, type AdminMemberPM } from "@/domain/moderation";
import { moderationService } from "@/services/moderation.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

/** Typing pauses this long before the search runs, so each keystroke isn't a request. */
const SEARCH_DEBOUNCE_MS = 300;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export function useAdminMembersPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY;
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<AdminMemberPM[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    const run = () =>
      moderationService.search(query).then(
        (rows) => {
          if (!live) return;
          setMembers(rows);
          setError(null);
          setLoadedFor(query);
        },
        (e: unknown) => {
          if (!live) return;
          setError(messageOf(e));
          setLoadedFor(query);
        },
      );
    const timer = setTimeout(run, query.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, access.isAdmin]);

  const rows = useMemo(
    () => members.map((m) => toAdminMemberRowVM(m, Routes.moderationMember)),
    [members],
  );
  const trimmed = query.trim();

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    query,
    setQuery,
    loading: access.isAdmin && loadedFor !== query,
    error,
    rows,
    heading: trimmed ? copy.search.results(trimmed) : copy.search.newest,
    empty: loadedFor === query && !error && rows.length === 0,
  };
}
