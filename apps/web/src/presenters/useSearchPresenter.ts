"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { SEARCH_COPY } from "@/constants/search";
import type { MemberCardPM } from "@/domain/member";
import {
  SEARCH_PEOPLE_PREVIEW,
  SEARCH_TABS,
  toSearchPersonVM,
  type SearchTab,
} from "@/domain/search";
import { ApiError } from "@/services/apiClient";
import { membersApi, toggleFollowOnCard } from "@/services/members.service";

/** How long typing pauses before searching; clearing the box applies at once. */
export const SEARCH_DELAY_MS = 300;
/** The API's limit on a search: longer would be refused. */
export const SEARCH_MAX_LENGTH = 50;
const PEOPLE_PAGE_SIZE = 20;

/** People found for one search; another search means "loading". */
interface PeoplePage {
  term: string;
  /** Which first load this is; a later page asked for an earlier one is dropped. */
  round: number;
  items: MemberCardPM[];
  total: number;
  page: number;
  error: string | null;
}

/**
 * The first `max` UTF-16 units (what the API counts), never half an emoji:
 * a lone surrogate would make the address unencodable.
 */
export function clip(text: string, max = SEARCH_MAX_LENGTH): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

const clean = (raw: string) => clip(raw.trim());

/** A follow set on this page: what it set, and when it settled (null while it's out). */
interface FollowSet {
  following: boolean;
  settledAt: number | null;
}

/**
 * The app's search, Facebook's way: one box for people and posts, with All,
 * People and Posts tabs. People come from here; the posts are the feed's own
 * (the page reads them with `useFeedPresenter({ search: term })`), so a post
 * found is liked, commented on and opened exactly as in the feed. The search
 * sits in the address (`?q=`), so Back and a shared link land on it again.
 */
export function useSearchPresenter(initialQuery: string | null) {
  const router = useRouter();
  const copy = SEARCH_COPY;
  const [query, setQuery] = useState(initialQuery ?? "");
  // What the results are for, once typing pauses.
  const [term, setTerm] = useState(clean(initialQuery ?? ""));
  const [tab, setTab] = useState<SearchTab>("all");
  const [people, setPeople] = useState<PeoplePage | null>(null);
  // The round whose next page is loading, so another search's never blocks this one's.
  const [loadingMoreRound, setLoadingMoreRound] = useState<number | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const rounds = useRef(0);
  // Orders requests and follows. A search asked for before a follow settled
  // can't know about it, so the row shows the follow; one asked for after it
  // settled is the truth (they may have unfollowed in another tab since).
  const clock = useRef(0);
  const follows = useRef(new Map<string, FollowSet>());
  const withFollows = useCallback(
    (items: MemberCardPM[], askedAt: number) =>
      items.map((p) => {
        const set = follows.current.get(p.userId);
        return set && (set.settledAt === null || askedAt < set.settledAt)
          ? { ...p, isFollowing: set.following }
          : p;
      }),
    [],
  );

  // The address can change under the page without remounting it: the header's
  // Search link back to an empty search, or Back and Forward between searches.
  // The box follows it then. Our own replace below lands on the same term, so
  // typing is never undone.
  const fromAddress = clean(initialQuery ?? "");
  const [addressSeen, setAddressSeen] = useState(fromAddress);
  if (fromAddress !== addressSeen) {
    setAddressSeen(fromAddress);
    if (fromAddress !== term) {
      setQuery(fromAddress);
      setTerm(fromAddress);
    }
  }

  useEffect(() => {
    const next = clean(query);
    const t = setTimeout(() => setTerm(next), next ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    router.replace(term ? Routes.searchFor(term) : Routes.search, { scroll: false });
  }, [term, router]);

  const onError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(Routes.login);
        return true;
      }
      return false;
    },
    [router],
  );

  useEffect(() => {
    if (!term) return;
    let live = true;
    const round = ++rounds.current;
    const askedAt = ++clock.current;
    membersApi.search(term, 1, PEOPLE_PAGE_SIZE).then(
      (res) => {
        if (live)
          setPeople({
            term,
            round,
            items: withFollows(res.items, askedAt),
            total: res.total,
            page: 1,
            error: null,
          });
      },
      (e: unknown) => {
        if (!live || onError(e)) return;
        setPeople({ term, round, items: [], total: 0, page: 1, error: copy.error });
      },
    );
    return () => {
      live = false;
    };
  }, [term, onError, copy.error, withFollows]);

  const current = term && people?.term === term ? people : null;
  const loadingMore = current !== null && loadingMoreRound === current.round;
  const morePeople = current ? current.items.length < current.total : false;

  const loadMorePeople = useCallback(() => {
    if (!current || loadingMore || !morePeople) return;
    const next = current.page + 1;
    const { round } = current;
    const askedAt = ++clock.current;
    setLoadingMoreRound(round);
    membersApi
      .search(current.term, next, PEOPLE_PAGE_SIZE)
      .then((res) =>
        setPeople((prev) =>
          prev && prev.round === round
            ? {
                ...prev,
                items: [...prev.items, ...withFollows(res.items, askedAt)],
                total: res.total,
                page: next,
                error: null,
              }
            : prev,
        ),
      )
      .catch((e: unknown) => {
        if (onError(e)) return;
        setPeople((prev) => (prev && prev.round === round ? { ...prev, error: copy.error } : prev));
      })
      .finally(() => setLoadingMoreRound((r) => (r === round ? null : r)));
  }, [current, loadingMore, morePeople, onError, copy.error, withFollows]);

  /** Optimistic: flips at once, holds once the API agrees, and goes back if it refuses. */
  const toggleFollow = useCallback(
    (userId: string) => {
      const pm = current?.items.find((p) => p.userId === userId);
      if (!pm?.username || busy.has(userId)) return;
      const apply = (to: (p: MemberCardPM) => MemberCardPM) => (prev: PeoplePage | null) =>
        prev ? { ...prev, items: prev.items.map((p) => (p.userId === userId ? to(p) : p)) } : prev;
      setBusy((prev) => new Set(prev).add(userId));
      follows.current.set(userId, { following: !pm.isFollowing, settledAt: null });
      setPeople(apply(toggleFollowOnCard));
      void (pm.isFollowing ? membersApi.unfollow(pm.username) : membersApi.follow(pm.username))
        // Done: whatever the rows have been refreshed to since, this is now true.
        .then(() => {
          follows.current.set(userId, { following: !pm.isFollowing, settledAt: ++clock.current });
          setPeople(apply((p) => ({ ...p, isFollowing: !pm.isFollowing })));
        })
        // Back to exactly how it was, even if a newer search has refreshed the row since.
        .catch(() => {
          follows.current.set(userId, { following: pm.isFollowing, settledAt: ++clock.current });
          setPeople(
            apply((p) => ({
              ...p,
              isFollowing: pm.isFollowing,
              followersCount: pm.followersCount,
            })),
          );
        })
        .finally(() =>
          setBusy((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          }),
        );
    },
    [current, busy],
  );

  const rows = useMemo(
    () =>
      (current?.items ?? []).map((pm) => ({
        ...toSearchPersonVM(pm, Routes.member),
        busy: busy.has(pm.userId),
      })),
    [current, busy],
  );

  const onAll = tab === "all";
  return {
    query,
    setQuery: (value: string) => setQuery(clip(value)),
    clear: () => setQuery(""),
    /** What the posts are searched for; the page hands it to the feed presenter. */
    term,
    tabs: SEARCH_TABS.map((key) => ({ key, label: copy.tabs[key], active: key === tab })),
    setTab,
    hint: term ? null : copy.hint,
    people: {
      shown: term !== "" && tab !== "posts",
      heading: onAll ? copy.people : null,
      rows: onAll ? rows.slice(0, SEARCH_PEOPLE_PREVIEW) : rows,
      loading: term !== "" && current === null,
      error: current?.error ?? null,
      empty: current && !current.error && current.items.length === 0 ? copy.noPeople(term) : null,
      seeAll:
        onAll && (current?.total ?? 0) > SEARCH_PEOPLE_PREVIEW
          ? { label: copy.seeAllPeople, onClick: () => setTab("people") }
          : null,
      hasMore: tab === "people" && morePeople,
      loadingMore,
      onLoadMore: loadMorePeople,
      onToggleFollow: toggleFollow,
    },
    /** Whether the posts are on screen. */
    postsShown: term !== "" && tab !== "people",
    /**
     * Whether the feed presenter reads posts: whenever there's a search, so
     * going to People and back keeps the posts (and their paging) as they were.
     */
    postsReady: term !== "",
    postsHeading: onAll ? copy.posts : null,
    postsEmpty: copy.noPosts(term),
    labels: {
      placeholder: copy.placeholder,
      label: copy.label,
      clear: copy.clear,
      searching: copy.searching,
      follow: copy.follow,
      following: copy.following,
      morePeople: copy.morePeople,
      loadMore: copy.loadMore,
    },
    maxLength: SEARCH_MAX_LENGTH,
  };
}
