"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_CATEGORY_LABELS, GROUP_LABELS, GROUPS_COPY } from "@/constants/groups";
import { Routes } from "@/constants/Routes";
import {
  GROUPS_VIEWS,
  toGroupRowVM,
  type GroupCategory,
  type GroupOptionsPM,
  type GroupSummaryPM,
  type GroupsView,
} from "@/domain/group";
import { ApiError } from "@/services/apiClient";
import { groupsService } from "@/services/groups.service";
import { countryName } from "@/util/format";

const CATEGORY_KEYS = Object.keys(GROUP_CATEGORY_LABELS) as GroupCategory[];
const SEARCH_DELAY_MS = 300;

/** The Groups directory: your groups, near you, popular and new; search and categories. */
export function useGroupsPresenter() {
  const router = useRouter();
  const [view, setView] = useState<GroupsView>("popular");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<GroupCategory | null>(null);
  const [items, setItems] = useState<GroupSummaryPM[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [noLocation, setNoLocation] = useState(false);
  const [loaded, setLoaded] = useState("");
  const [failedKey, setFailedKey] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [options, setOptions] = useState<GroupOptionsPM | null>(null);
  const [reload, setReload] = useState(0);
  const key = `${view}|${search}|${category ?? ""}|${reload}`;
  const loading = loaded !== key;
  const failed = failedKey === key;

  const signedOut = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(Routes.login);
        return true;
      }
      return false;
    },
    [router],
  );

  // A search runs once the member stops typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let live = true;
    groupsService.options().then(
      (o) => live && setOptions(o),
      (e) => live && signedOut(e),
    );
    return () => {
      live = false;
    };
  }, [signedOut]);

  useEffect(() => {
    let live = true;
    groupsService.list({ view, q: search, category }).then(
      (res) => {
        if (!live) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        setNoLocation(res.hint === "no_location");
        setPage(1);
        setLoaded(key);
      },
      (e) => {
        if (!live || signedOut(e)) return;
        setFailedKey(key);
        setLoaded(key);
      },
    );
    return () => {
      live = false;
    };
  }, [view, search, category, key, signedOut]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await groupsService.list({ view, q: search, category, page: page + 1 });
      setItems((shown) => [
        ...shown,
        ...res.items.filter((g) => !shown.some((s) => s.id === g.id)),
      ]);
      setHasMore(res.hasMore);
      setPage((p) => p + 1);
    } catch (e) {
      if (!signedOut(e)) setFailedKey(key);
    } finally {
      setLoadingMore(false);
    }
  };

  const empty = search
    ? GROUPS_COPY.empty.search
    : view === "near" && noLocation
      ? GROUPS_COPY.empty.noLocation
      : GROUPS_COPY.empty[view];

  return {
    title: GROUPS_COPY.title,
    intro: GROUPS_COPY.intro,
    search: { value: query, placeholder: GROUPS_COPY.searchPlaceholder, onChange: setQuery },
    views: GROUPS_VIEWS.map((key) => ({
      key,
      label: GROUPS_COPY.views[key],
      active: key === view,
      onSelect: () => setView(key),
    })),
    categories: [
      {
        key: "all",
        label: GROUPS_COPY.allCategories,
        active: category === null,
        onSelect: () => setCategory(null),
      },
      ...CATEGORY_KEYS.map((key) => ({
        key,
        label: GROUP_CATEGORY_LABELS[key],
        active: category === key,
        onSelect: () => setCategory(key),
      })),
    ],
    rows: items.map((pm) => toGroupRowVM(pm, GROUP_LABELS, Routes.group(pm.slug), countryName)),
    loading,
    loadingText: GROUPS_COPY.loading,
    error: failed ? GROUPS_COPY.error : null,
    retryLabel: GROUPS_COPY.retry,
    retry: () => setReload((n) => n + 1),
    empty: !loading && !failed && items.length === 0 ? empty : null,
    loadMore: hasMore
      ? { label: GROUPS_COPY.loadMore, busy: loadingMore, onClick: loadMore }
      : null,
    /** Create for Silver members; otherwise the way to Silver, or nothing while it can't help. */
    create: !options
      ? null
      : options.canCreate
        ? { label: GROUPS_COPY.create, href: Routes.newGroup }
        : options.refusal === "silver"
          ? { label: GROUPS_COPY.silverToCreate, href: Routes.subscription }
          : null,
  };
}
