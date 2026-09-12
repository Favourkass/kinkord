"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import { toPublicProfileVM, type FriendRowVM, type PublicProfilePM } from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import {
  decodeParam,
  hasMore,
  membersApi,
  toggleFollowOnFriend,
  type FriendPM,
  type FriendsTab,
} from "@/services/members.service";

const PAGE = 30;
const TABS: FriendsTab[] = ["all", "followers", "following", "suggested"];
const isTab = (v: string | null | undefined): v is FriendsTab => TABS.includes(v as FriendsTab);

interface PageOutcome {
  key: string;
  items: FriendPM[];
  total: number;
  page: number;
  error: string | null;
}

/** People "See more" page (Figma 1322:25 → 1528:274): the full list with infinite scroll. */
export function usePeoplePagePresenter(usernameParam: string, tabParam?: string | null) {
  const router = useRouter();
  const copy = MEMBERS_COPY.profile.people;
  const username = decodeParam(usernameParam).replace(/^@/, "");
  const [tab, setTabState] = useState<FriendsTab>(isTab(tabParam) ? tabParam : "all");
  const [profile, setProfile] = useState<{ username: string; pm: PublicProfilePM | null } | null>(
    null,
  );
  const [data, setData] = useState<PageOutcome | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [fatal, setFatal] = useState<string | null>(null);

  const pm = profile?.username === username ? profile.pm : null;
  const key = `${username}|${tab}`;
  const current = data?.key === key ? data : null;

  useEffect(() => {
    let cancelled = false;
    void membersApi
      .profile(username)
      .then((res) => {
        if (!cancelled) setProfile({ username, pm: res });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setFatal(
          e instanceof ApiError && e.status === 404
            ? MEMBERS_COPY.profile.notFound
            : MEMBERS_COPY.common.error,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [username, router]);

  useEffect(() => {
    if (current) return;
    let cancelled = false;
    void membersApi
      .friends(username, tab, 1, PAGE)
      .then((res) => {
        if (!cancelled) setData({ key, items: res.items, total: res.total, page: 1, error: null });
      })
      .catch(() => {
        if (!cancelled)
          setData({ key, items: [], total: 0, page: 1, error: MEMBERS_COPY.common.error });
      });
    return () => {
      cancelled = true;
    };
  }, [username, tab, key, current]);

  const more = hasMore(current?.items.length ?? 0, current?.total ?? 0);
  const loadMore = useCallback(() => {
    if (!current || loadingMore || !more) return;
    const next = current.page + 1;
    setLoadingMore(true);
    void membersApi
      .friends(username, tab, next, PAGE)
      .then((res) =>
        setData((prev) =>
          prev && prev.key === key
            ? { ...prev, items: [...prev.items, ...res.items], total: res.total, page: next }
            : prev,
        ),
      )
      .catch(() =>
        setData((prev) =>
          prev && prev.key === key ? { ...prev, error: MEMBERS_COPY.common.error } : prev,
        ),
      )
      .finally(() => setLoadingMore(false));
  }, [current, loadingMore, more, username, tab, key]);

  const setTab = useCallback(
    (next: string) => {
      if (!isTab(next)) return;
      setTabState(next);
      router.replace(Routes.memberPeople(username, next));
    },
    [router, username],
  );

  const toggleFollow = useCallback((row: FriendRowVM) => {
    if (!row.username) return;
    const { userId, username: handle, isFollowing } = row;
    const flip = (d: PageOutcome | null) =>
      d
        ? { ...d, items: d.items.map((i) => (i.userId === userId ? toggleFollowOnFriend(i) : i)) }
        : d;
    setBusy((prev) => new Set(prev).add(userId));
    setData(flip);
    void (isFollowing ? membersApi.unfollow(handle) : membersApi.follow(handle))
      .catch(() => setData(flip))
      .finally(() =>
        setBusy((prev) => {
          const n = new Set(prev);
          n.delete(userId);
          return n;
        }),
      );
  }, []);

  const vm = useMemo(() => (pm ? toPublicProfileVM(pm) : null), [pm]);
  const label = (key: FriendsTab) =>
    key === "all"
      ? copy.tabs.all(vm?.stats.friends ?? "0")
      : key === "followers"
        ? copy.tabs.followers(vm?.stats.followers ?? "0")
        : key === "following"
          ? copy.tabs.following(vm?.stats.following ?? "0")
          : key === "mutual"
            ? copy.tabs.mutual(vm?.stats.mutualFriends ?? "0")
            : copy.tabs.suggested;

  const rows = (current?.items ?? []).map((f) => ({
    userId: f.userId,
    username: f.username,
    displayName: f.displayName,
    handle: f.username ? `@${f.username}` : null,
    avatarUrl: f.avatarUrl,
    isFollowing: f.isFollowing,
    busy: busy.has(f.userId),
    href: Routes.member(f.username ?? f.userId),
    pill: Boolean(pm?.isSelf) && tab === "all",
  }));

  return {
    loading: !fatal && (pm === null || current === null),
    error: fatal,
    title: vm ? copy.pageTitle(vm.displayName) : "",
    backLabel: copy.back,
    back: () => router.push(Routes.member(username)),
    activeTab: pm?.isSelf ? ("profile" as const) : undefined,
    people: {
      subTabs: TABS.map((key) => ({ key, label: label(key), active: tab === key })),
      onSubTab: setTab,
      rows,
      labels: {
        follow: copy.follow,
        following: copy.following,
        friendsPill: copy.friendsPill,
        more: copy.more,
      },
      onToggleFollow: toggleFollow,
      loading: current === null,
      loadingText: MEMBERS_COPY.common.loading,
      empty: current && current.items.length === 0 && !current.error ? copy.empty[tab] : null,
      error: current?.error ?? null,
      seeMoreHref: null,
      seeMoreLabel: copy.seeMore,
    },
    hasMore: more,
    loadMore,
    loadingMore,
    loadingMoreText: copy.loadingMore,
    endText: current && current.items.length > 0 && !more ? copy.end : null,
  };
}
