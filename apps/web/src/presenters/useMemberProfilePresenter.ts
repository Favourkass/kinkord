"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import {
  toPublicProfileVM,
  type FriendRowVM,
  type MemberCardPM,
  type PublicProfilePM,
} from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import {
  decodeParam,
  membersApi,
  toggleFollowOnCard,
  toggleFollowOnFriend,
  toggleFollowOnProfile,
  type FriendPM,
  type FriendsTab,
} from "@/services/members.service";

export type ProfileTabKey = "posts" | "about" | "media" | "friends";
export type MediaFilterKey = "all" | "profile" | "recent";

const TAB_KEYS: ProfileTabKey[] = ["posts", "about", "media", "friends"];
const isTabKey = (v: string | null | undefined): v is ProfileTabKey =>
  TAB_KEYS.includes(v as ProfileTabKey);

/** Outcome of loading one username; keyed so a route change never shows stale data. */
interface ProfileOutcome {
  username: string;
  pm: PublicProfilePM | null;
  notFound: boolean;
  error: string | null;
}

/** Friends list for one (username, tab) key. */
interface FriendsOutcome {
  key: string;
  items: FriendPM[];
  total: number;
  error: string | null;
}

/** "Suggested Friends": members from the same state, keyed by username. */
interface SuggestOutcome {
  username: string;
  items: MemberCardPM[];
}

const FRIENDS_PAGE = 50;
const SUGGESTIONS = 3;

/** Another member's public profile (Figma 948:2866 / 926:818 / 987:5468): hero, tabs, About, Friends, empty Posts/Media. */
export function useMemberProfilePresenter(usernameParam: string, initialTab?: string | null) {
  const router = useRouter();
  const copy = MEMBERS_COPY.profile;
  const username = decodeParam(usernameParam).replace(/^@/, "");
  const [outcome, setOutcome] = useState<ProfileOutcome | null>(null);
  // Deep-linkable via ?tab=…; About is the default because Posts/Media have no content yet.
  const [tab, setTab] = useState<ProfileTabKey>(isTabKey(initialTab) ? initialTab : "about");
  const [followBusy, setFollowBusy] = useState(false);
  const [friendsTab, setFriendsTab] = useState<FriendsTab>("all");
  const [friends, setFriends] = useState<FriendsOutcome | null>(null);
  const [suggested, setSuggested] = useState<SuggestOutcome | null>(null);
  const [rowBusy, setRowBusy] = useState<ReadonlySet<string>>(new Set());
  const [mediaFilter, setMediaFilter] = useState<MediaFilterKey>("all");

  // Only an outcome for the *current* username counts; anything else means "loading".
  const current = outcome?.username === username ? outcome : null;
  const pm = current?.pm ?? null;

  useEffect(() => {
    let cancelled = false;
    void membersApi
      .profile(username)
      .then((res) => {
        if (!cancelled) setOutcome({ username, pm: res, notFound: false, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        const notFound = e instanceof ApiError && e.status === 404;
        setOutcome({
          username,
          pm: null,
          notFound,
          error: notFound ? null : MEMBERS_COPY.common.error,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [username, router]);

  // Friends load lazily, when the tab is open, per (username, sub-tab) key.
  const friendsKey = `${username}|${friendsTab}`;
  const currentFriends = friends?.key === friendsKey ? friends : null;
  useEffect(() => {
    if (tab !== "friends" || !pm || currentFriends) return;
    let cancelled = false;
    void membersApi
      .friends(username, friendsTab, 1, FRIENDS_PAGE)
      .then((res) => {
        if (!cancelled)
          setFriends({ key: friendsKey, items: res.items, total: res.total, error: null });
      })
      .catch(() => {
        if (!cancelled)
          setFriends({ key: friendsKey, items: [], total: 0, error: MEMBERS_COPY.common.error });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, pm, currentFriends, username, friendsTab, friendsKey]);

  // Suggested friends: members from the same state (desktop right column). Best effort, never blocks.
  const currentSuggested = suggested?.username === username ? suggested : null;
  useEffect(() => {
    if (!pm || !pm.state || currentSuggested) return;
    let cancelled = false;
    void membersApi
      .page({
        country: pm.country ?? "NG",
        state: pm.state,
        region: null,
        page: 1,
        limit: 5,
        sort: "recent",
      })
      .then((res) => {
        if (cancelled) return;
        const items = res.items.filter((m) => m.userId !== pm.userId).slice(0, SUGGESTIONS);
        setSuggested({ username, items });
      })
      .catch(() => {
        if (!cancelled) setSuggested({ username, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [pm, currentSuggested, username]);

  /** Optimistic follow flip on the profile; reverts if the API rejects. */
  const toggleFollow = useCallback(() => {
    if (!pm || pm.isSelf || !pm.username || followBusy) return;
    const flip = (o: ProfileOutcome | null) =>
      o?.pm ? { ...o, pm: toggleFollowOnProfile(o.pm) } : o;
    setFollowBusy(true);
    setOutcome(flip);
    void (pm.isFollowing ? membersApi.unfollow(pm.username) : membersApi.follow(pm.username))
      .catch(() => setOutcome(flip))
      .finally(() => setFollowBusy(false));
  }, [pm, followBusy]);

  const markBusy = (userId: string, busy: boolean) =>
    setRowBusy((prev) => {
      const next = new Set(prev);
      if (busy) next.add(userId);
      else next.delete(userId);
      return next;
    });

  /** Optimistic follow flip on a friends-list row. */
  const toggleFriendFollow = useCallback((row: FriendRowVM) => {
    if (!row.username) return;
    const { userId, username: handle, isFollowing } = row;
    const flip = (f: FriendsOutcome | null) =>
      f
        ? { ...f, items: f.items.map((i) => (i.userId === userId ? toggleFollowOnFriend(i) : i)) }
        : f;
    markBusy(userId, true);
    setFriends(flip);
    void (isFollowing ? membersApi.unfollow(handle) : membersApi.follow(handle))
      .catch(() => setFriends(flip))
      .finally(() => markBusy(userId, false));
  }, []);

  /** "Add" on a suggested friend = follow (optimistic, reverts on failure). */
  const addSuggested = useCallback((row: FriendRowVM) => {
    if (!row.username) return;
    const { userId, username: handle, isFollowing } = row;
    const flip = (s: SuggestOutcome | null) =>
      s
        ? { ...s, items: s.items.map((i) => (i.userId === userId ? toggleFollowOnCard(i) : i)) }
        : s;
    markBusy(userId, true);
    setSuggested(flip);
    void (isFollowing ? membersApi.unfollow(handle) : membersApi.follow(handle))
      .catch(() => setSuggested(flip))
      .finally(() => markBusy(userId, false));
  }, []);

  const share = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      void navigator.share({ url }).catch(() => undefined);
    } else if (navigator.clipboard) {
      void navigator.clipboard.writeText(url).catch(() => undefined);
    }
  }, []);

  const vm = useMemo(() => (pm ? toPublicProfileVM(pm) : null), [pm]);
  const presenceText = vm
    ? vm.isOnline
      ? copy.online
      : vm.lastSeenAgo
        ? copy.lastSeen(vm.lastSeenAgo)
        : null
    : null;

  const tabs = (Object.keys(copy.tabs) as ProfileTabKey[]).map((key) => ({
    key,
    label: copy.tabs[key],
  }));

  const toRow = (f: {
    userId: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
    isFollowing: boolean;
  }): FriendRowVM => ({
    userId: f.userId,
    username: f.username,
    displayName: f.displayName,
    handle: f.username ? `@${f.username}` : null,
    avatarUrl: f.avatarUrl,
    isFollowing: f.isFollowing,
    busy: rowBusy.has(f.userId),
  });
  const friendRows = useMemo<FriendRowVM[]>(
    () => (currentFriends?.items ?? []).map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFriends, rowBusy],
  );
  const suggestedRows = useMemo<FriendRowVM[]>(
    () => (currentSuggested?.items ?? []).map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentSuggested, rowBusy],
  );

  const statsLabels = copy.stats;
  return {
    loading: current === null,
    error: current?.error ?? null,
    notFound: current?.notFound ? copy.notFound : null,
    vm,
    presenceText,
    nav: {
      brand: copy.brand,
      searchHref: Routes.members,
      labels: copy.actions,
      onMore: () => undefined,
      onShare: share,
    },
    topNav: {
      brand: copy.brand,
      searchHref: Routes.members,
      searchPlaceholder: copy.desktop.searchPlaceholder,
      accountLabel: copy.desktop.account,
    },
    tab,
    setTab: (key: string) => setTab(key as ProfileTabKey),
    tabs,
    toggleFollow,
    followBusy,
    messageHref: Routes.messages,
    editHref: Routes.profileEdit,
    heroLabels: {
      follow: copy.follow,
      following: copy.following,
      message: copy.message,
      yourself: copy.yourself,
      editProfile: copy.editProfile,
      stats: statsLabels,
    },
    sideLabels: {
      follow: copy.follow,
      following: copy.following,
      message: copy.message,
      yourself: copy.yourself,
      editProfile: copy.editProfile,
      tagsHeading: copy.desktop.tagsHeading,
      stats: statsLabels,
    },
    aboutLabels: copy.about,
    friends: {
      heading: copy.friends.heading,
      headingDesktop: copy.desktop.friendsList,
      subTabs: [
        {
          key: "all" as const,
          label: copy.friends.all(vm?.stats.friends ?? "0"),
          active: friendsTab === "all",
        },
        {
          key: "mutual" as const,
          label: copy.friends.mutual(vm?.stats.mutualFriends ?? "0"),
          active: friendsTab === "mutual",
        },
      ],
      onSubTab: setFriendsTab,
      rows: friendRows,
      labels: {
        follow: copy.friends.follow,
        following: copy.friends.following,
        more: copy.friends.more,
      },
      onToggleFollow: toggleFriendFollow,
      loading: tab === "friends" && pm !== null && currentFriends === null,
      loadingText: MEMBERS_COPY.common.loading,
      empty:
        currentFriends && currentFriends.items.length === 0 && !currentFriends.error
          ? copy.friends.empty
          : null,
      error: currentFriends?.error ?? null,
    },
    suggested: {
      heading: copy.desktop.suggested,
      rows: suggestedRows,
      addLabel: copy.desktop.add,
      addedLabel: copy.desktop.added,
      onAdd: addSuggested,
      empty: copy.desktop.noSuggestions,
    },
    posts: {
      authorName: vm?.displayName ?? "",
      authorAvatarUrl: vm?.avatarUrl ?? null,
      emptyText: copy.posts.empty,
      labels: { like: copy.posts.like, comment: copy.posts.comment, share: copy.posts.share },
    },
    media: {
      heading: copy.media.heading,
      countLabel: copy.media.count(0),
      filters: (["all", "profile", "recent"] as MediaFilterKey[]).map((key) => ({
        key,
        label: copy.media.filters[key],
        active: mediaFilter === key,
      })),
      onFilter: (key: string) => setMediaFilter(key as MediaFilterKey),
      photos: [] as Array<{ id: string; url: string; featured?: boolean }>,
      featuredLabel: copy.media.featured,
      emptyText: copy.media.empty,
    },
  };
}
