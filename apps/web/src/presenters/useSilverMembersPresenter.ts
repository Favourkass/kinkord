"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import {
  toSilverMemberVM,
  type SilverFilter,
  type SilverMemberPM,
  type SilverMembersPM,
} from "@/domain/silverMembers";
import { planDate } from "@/domain/subscription";
import { silverMembersAdminApi } from "@/services/silverMembers.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

const SEARCH_DELAY_MS = 300;
const FILTERS: SilverFilter[] = ["all", "subscription", "ring", "given"];

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** Everyone on Silver now (Moderation → Silver): paid, a Kink Ring, or given by Kinkord. */
export function useSilverMembersPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.silverMembers;
  const [filter, setFilter] = useState<SilverFilter>("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  // Kept with what it was loaded for, so a slow answer never fills another filter's list.
  const [loaded, setLoaded] = useState<{
    key: string;
    counts: SilverMembersPM["counts"];
    items: SilverMemberPM[];
    nextPage: number | null;
  } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const key = `${filter}|${search}`;

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    const asked = `${filter}|${search}`;
    silverMembersAdminApi.list(filter, search, 1).then(
      (pm) => live && setLoaded({ key: asked, ...pm }),
      (e: unknown) => live && setFailed({ key: asked, message: messageOf(e) }),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, filter, search]);

  const current = loaded?.key === key ? loaded : null;
  const error = failed?.key === key ? failed.message : null;

  const more = useCallback(async () => {
    if (!current?.nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const pm = await silverMembersAdminApi.list(filter, search, current.nextPage);
      setLoaded((prev) =>
        prev && prev.key === key
          ? { ...prev, items: [...prev.items, ...pm.items], nextPage: pm.nextPage }
          : prev,
      );
    } catch (e) {
      setFailed({ key, message: messageOf(e) });
    } finally {
      setLoadingMore(false);
    }
  }, [current, filter, key, loadingMore, search]);

  const members = useMemo(
    () =>
      (current?.items ?? []).map((m) =>
        toSilverMemberVM(m, copy, planDate, Routes.moderationMember),
      ),
    [current, copy],
  );

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    view: {
      title: copy.title,
      filters: FILTERS.map((value) => ({
        value,
        label: copy.filters[value](loaded?.counts[value] ?? 0),
        active: value === filter,
      })),
      onFilter: setFilter,
      query,
      onQuery: setQuery,
      searchLabel: copy.search,
      loading: access.isAdmin && !current && !error ? copy.loading : null,
      error,
      empty: current && current.items.length === 0 ? copy.empty : null,
      members,
      moreLabel: current?.nextPage ? (loadingMore ? copy.loadingMore : copy.more) : null,
      onMore: () => void more(),
    },
  };
}

export type SilverMembersViewVM = ReturnType<typeof useSilverMembersPresenter>["view"];
