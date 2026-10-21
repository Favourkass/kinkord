"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KEEP_TYPING } from "@/constants/location";
import { MEMBERS_COPY, MEMBERS_PAGE_SIZE } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import {
  toMemberCardVM,
  type MemberCardPM,
  type MemberCardVM,
  type RegionRowVM,
} from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import { isOrganization } from "@/services/organizations.service";
import { useOrganizations } from "./useOrganizations";
import {
  decodeParam,
  hasMore,
  isCountryAvailable,
  membersApi,
  nextSort,
  toggleFollowOnCard,
  type MembersSort,
} from "@/services/members.service";
import { isKnownState, regionsForState, statesForCountry } from "@/services/location.service";
import { countryName, displayState } from "@/util/format";
import { optionMatcher } from "@/util/textSearch";

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
const NO_REGIONS: string[] = [];

/** How long typing pauses before the list searches; clearing the box applies at once. */
export const SEARCH_DELAY_MS = 300;
/** The API's limit on a search (GET /members q): longer would be refused. */
export const SEARCH_MAX_LENGTH = 50;

/**
 * Members list at every level of the directory (Figma 907:1410 list layout):
 *   /members/ng        → everyone in Nigeria, dropdown of states (picking one navigates)
 *   /members/ng/Delta  → everyone in Delta, dropdown of LGAs (picking one filters)
 * CEO, 2026-09-12: each click shows everyone in that place; the next click narrows.
 * "{n} Members Found", Sort toggle, online-first cards, infinite scroll, optimistic Follow.
 */
export function useMembersRegionPresenter(
  countryParam: string,
  stateParam?: string | null,
  /** From `?region=` — a profile's city links straight to its own area. */
  initialRegion?: string | null,
) {
  const organizations = useOrganizations();
  const router = useRouter();
  const copy = MEMBERS_COPY.region;
  const country = countryParam.toUpperCase();
  const state = stateParam ? decodeParam(stateParam) : null;
  const countryMode = state === null;

  // null = the whole state (CEO, 2026-09-08); picking an LGA narrows the list.
  const [region, setRegion] = useState<string | null>(
    initialRegion ? decodeParam(initialRegion) : null,
  );
  const [sort, setSort] = useState<MembersSort>("recent");
  // What's typed, and what the list searches once typing pauses.
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  // What's typed in the sheet's own search, over the states or the state's towns.
  const [regionQuery, setRegionQuery] = useState("");
  // A state's towns (thousands, for some) are fetched when its sheet first opens.
  const [towns, setTowns] = useState<{ key: string; list: string[] } | null>(null);
  const townsKey = state ? `${country}|${state}` : null;
  useEffect(() => {
    if (!sheetOpen || !state) return;
    let live = true;
    const loadedKey = `${country}|${state}`;
    void regionsForState(country, state).then((list) => {
      if (live) setTowns({ key: loadedKey, list });
    });
    return () => {
      live = false;
    };
  }, [sheetOpen, country, state]);
  const loadedTowns = towns && towns.key === townsKey ? towns.list : null;
  const regions = useMemo(
    () => (countryMode ? statesForCountry(country) : (loadedTowns ?? NO_REGIONS)),
    [countryMode, country, loadedTowns],
  );
  const matchRegion = useMemo(
    () => optionMatcher(regions.map((name) => ({ value: name, label: name }))),
    [regions],
  );
  const regionHits = useMemo(() => matchRegion(regionQuery), [matchRegion, regionQuery]);
  const [data, setData] = useState<RegionPage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  // Country mode needs a launched country; state mode needs a state we have LGAs for.
  const knownState = countryMode ? isCountryAvailable(country) : isKnownState(country, state);
  const key = knownState ? `${country}|${state ?? "*"}|${region ?? "*"}|${sort}|${search}` : null;
  const current = data?.key === key ? data : null;
  const loading = key !== null && current === null;
  const items = current?.items ?? NO_ITEMS;
  const total = current?.total ?? 0;
  const page = current?.page ?? 1;
  const error = current?.error ?? null;

  useEffect(() => {
    const term = query.trim().slice(0, SEARCH_MAX_LENGTH);
    const t = setTimeout(() => setSearch(term), term ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(t);
  }, [query]);

  // First page whenever the region / sort / search / route changes; stale responses are dropped.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void membersApi
      .page({ country, state, region, q: search, page: 1, limit: MEMBERS_PAGE_SIZE, sort })
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
  }, [country, state, region, search, sort, key, router]);

  const more = hasMore(items.length, total);

  const loadMore = useCallback(() => {
    if (!key || loading || loadingMore || !more) return;
    const next = page + 1;
    setLoadingMore(true);
    void membersApi
      .page({ country, state, region, q: search, page: next, limit: MEMBERS_PAGE_SIZE, sort })
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
  }, [country, state, region, search, sort, key, page, loading, loadingMore, more, router]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setRegionQuery("");
  }, []);

  const selectRegion = useCallback(
    (next: string) => {
      closeSheet();
      if (countryMode) {
        // Picking a state on the country page opens that state's own list.
        if (next !== copy.allStates) router.push(Routes.membersState(country, next));
        return;
      }
      setRegion(next === copy.allRegions ? null : next);
    },
    [countryMode, copy.allStates, copy.allRegions, router, country, closeSheet],
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
        const card = toMemberCardVM(pm, isOrganization(pm.userId, organizations));
        return {
          card,
          href: Routes.member(pm.username ?? pm.userId),
          openProfileLabel: copy.openProfile(card.title),
          busy: busy.has(pm.userId),
        };
      }),
    [items, busy, copy, organizations],
  );

  const placeName = countryMode ? (countryName(country) ?? country) : displayState(state, country);

  return {
    title: placeName,
    subtitle: copy.subtitle,
    unknownState: knownState
      ? null
      : countryMode
        ? MEMBERS_COPY.state.notAvailable
        : copy.unknownState,
    search: {
      value: query,
      onChange: setQuery,
      placeholder: copy.searchPlaceholder,
      label: copy.searchLabel,
      iconSize: countryMode ? (24 as const) : (26 as const),
      maxLength: SEARCH_MAX_LENGTH,
    },
    selector: {
      label: copy.selectorLabel,
      value: countryMode ? copy.allStates : (region ?? copy.allRegions),
      options: [
        countryMode ? copy.allStates : copy.allRegions,
        ...regionHits.hits.map((hit) => hit.label),
      ],
      open: sheetOpen,
      onOpen: () => setSheetOpen(true),
      onClose: closeSheet,
      onSelect: selectRegion,
      search: {
        value: regionQuery,
        onChange: setRegionQuery,
        placeholder: countryMode ? copy.searchStates : copy.searchRegions,
      },
      status:
        !countryMode && loadedTowns === null
          ? copy.loadingRegions
          : regionHits.more
            ? KEEP_TYPING
            : regionHits.hits.length === 0 && regionQuery.trim()
              ? copy.noRegionMatch
              : null,
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
      organization: MEMBERS_COPY.profile.organization,
      verifiedOrganization: MEMBERS_COPY.profile.verifiedOrganization,
    },
    loading,
    loadingMore,
    hasMore: more,
    loadMore,
    onToggleFollow: toggleFollow,
    empty:
      !loading && !error && knownState && items.length === 0
        ? search
          ? copy.noMatch(search, region ?? placeName)
          : copy.empty(region ?? placeName)
        : null,
    loadingMoreText: copy.loadingMore,
    // "Everyone here" isn't true of a search's results.
    endText: items.length > 0 && !more && !search ? copy.end : null,
    error,
  };
}
