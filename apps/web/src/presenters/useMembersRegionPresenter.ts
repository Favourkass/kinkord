"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY, MEMBERS_PAGE_SIZE } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import {
  toMemberCardVM,
  type MemberCardPM,
  type MemberCardVM,
  type RegionRowVM,
} from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import {
  decodeParam,
  hasMore,
  isCountryAvailable,
  membersApi,
  nextSort,
  regionsForState,
  statesForCountry,
  toggleFollowOnCard,
  type MembersSort,
} from "@/services/members.service";
import { countryName, displayState } from "@/util/format";

/** Loaded pages for one country/state/region/sort key; a different key means "loading". */
interface RegionPage {
  key: string;
  items: MemberCardPM[];
  total: number;
  page: number;
  error: string | null;
}

/** Stable empty list so derived memos don't churn while a page is loading. */
const NO_ITEMS: MemberCardPM[] = [];

/**
 * Members list at every level of the directory (Figma 907:1410 list layout):
 *   /members/ng        → everyone in Nigeria, dropdown of states (picking one navigates)
 *   /members/ng/Delta  → everyone in Delta, dropdown of LGAs (picking one filters)
 * CEO, 2026-09-12: each click shows everyone in that place; the next click narrows.
 * "{n} Members Found", Sort toggle, online-first cards, infinite scroll, optimistic Follow.
 */
export function useMembersRegionPresenter(countryParam: string, stateParam?: string | null) {
  const router = useRouter();
  const copy = MEMBERS_COPY.region;
  const country = countryParam.toUpperCase();
  const state = stateParam ? decodeParam(stateParam) : null;
  const countryMode = state === null;
  const regions = useMemo(
    () => (state ? regionsForState(country, state) : statesForCountry(country)),
    [country, state],
  );

  // null = the whole state (CEO, 2026-09-08); picking an LGA narrows the list.
  const [region, setRegion] = useState<string | null>(null);
  const [sort, setSort] = useState<MembersSort>("recent");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [data, setData] = useState<RegionPage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  // Country mode needs a launched country; state mode needs a state we have LGAs for.
  const knownState = countryMode ? isCountryAvailable(country) : regions.length > 0;
  const key = knownState ? `${country}|${state ?? "*"}|${region ?? "*"}|${sort}` : null;
  const current = data?.key === key ? data : null;
  const loading = key !== null && current === null;
  const items = current?.items ?? NO_ITEMS;
  const total = current?.total ?? 0;
  const page = current?.page ?? 1;
  const error = current?.error ?? null;

  // First page whenever the region / sort / route changes; stale responses are dropped.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void membersApi
      .page({ country, state, region, page: 1, limit: MEMBERS_PAGE_SIZE, sort })
      .then((res) => {
        if (!cancelled) setData({ key, items: res.items, total: res.total, page: 1, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setData({ key, items: [], total: 0, page: 1, error: MEMBERS_COPY.common.error });
      });
    return () => {
      cancelled = true;
    };
  }, [country, state, region, sort, key, router]);

  const more = hasMore(items.length, total);

  const loadMore = useCallback(() => {
    if (!key || loading || loadingMore || !more) return;
    const next = page + 1;
    setLoadingMore(true);
    void membersApi
      .page({ country, state, region, page: next, limit: MEMBERS_PAGE_SIZE, sort })
      .then((res) =>
        setData((prev) =>
          prev && prev.key === key
            ? { ...prev, items: [...prev.items, ...res.items], total: res.total, page: next }
            : prev,
        ),
      )
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setData((prev) =>
          prev && prev.key === key ? { ...prev, error: MEMBERS_COPY.common.error } : prev,
        );
      })
      .finally(() => setLoadingMore(false));
  }, [country, state, region, sort, key, page, loading, loadingMore, more, router]);

  const selectRegion = useCallback(
    (next: string) => {
      setSheetOpen(false);
      if (countryMode) {
        // Picking a state on the country page opens that state's own list.
        if (next !== copy.allStates) router.push(Routes.membersState(country, next));
        return;
      }
      setRegion(next === copy.allRegions ? null : next);
    },
    [countryMode, copy.allStates, copy.allRegions, router, country],
  );

  const toggleSort = useCallback(() => setSort((s) => nextSort(s)), []);

  /** Optimistic follow flip; reverts if the API rejects. Never opens the profile. */
  const toggleFollow = useCallback((card: MemberCardVM) => {
    if (!card.username) return;
    const { userId, username, isFollowing } = card;
    const flip = (prev: RegionPage | null) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((pm) => (pm.userId === userId ? toggleFollowOnCard(pm) : pm)),
          }
        : prev;
    setBusy((prev) => new Set(prev).add(userId));
    setData(flip);
    void (isFollowing ? membersApi.unfollow(username) : membersApi.follow(username))
      .catch(() => setData(flip))
      .finally(() =>
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        }),
      );
  }, []);

  const rows = useMemo<RegionRowVM[]>(
    () =>
      items.map((pm) => {
        const card = toMemberCardVM(pm);
        return {
          card,
          href: Routes.member(pm.username ?? pm.userId),
          openProfileLabel: copy.openProfile(card.title),
          busy: busy.has(pm.userId),
        };
      }),
    [items, busy, copy],
  );

  const placeName = countryMode ? (countryName(country) ?? country) : displayState(state);

  return {
    title: placeName,
    subtitle: copy.subtitle,
    unknownState: knownState
      ? null
      : countryMode
        ? MEMBERS_COPY.state.notAvailable
        : copy.unknownState,
    selector: {
      label: copy.selectorLabel,
      value: countryMode ? copy.allStates : (region ?? copy.allRegions),
      options: [countryMode ? copy.allStates : copy.allRegions, ...regions],
      open: sheetOpen,
      onOpen: () => setSheetOpen(true),
      onClose: () => setSheetOpen(false),
      onSelect: selectRegion,
      sheetTitle: countryMode ? copy.sheetTitleStates : copy.sheetTitle,
      closeLabel: copy.closeSheet,
      searchByRegionLabel: countryMode ? copy.searchByState : copy.searchByRegion,
    },
    count: total.toLocaleString("en-US"),
    foundLabel: copy.found,
    sort,
    sortLabel: copy.sort,
    sortAria: copy.sortLabel(copy.sortModes[sort]),
    onSort: toggleSort,
    viewListLabel: copy.viewList,
    rows,
    cardLabels: {
      follow: copy.follow,
      following: copy.following,
      posts: copy.posts,
      followers: copy.followers,
    },
    loading,
    loadingMore,
    hasMore: more,
    loadMore,
    onToggleFollow: toggleFollow,
    empty:
      !loading && !error && knownState && items.length === 0
        ? copy.empty(region ?? placeName)
        : null,
    loadingMoreText: copy.loadingMore,
    endText: items.length > 0 && !more ? copy.end : null,
    error,
  };
}
