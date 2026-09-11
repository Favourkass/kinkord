import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import {
  type FriendRowVM,
  type MemberCardPM,
  type PublicProfilePM,
  toPublicProfileVM,
} from "@/domain/member";
import {
  type FriendPM,
  type FriendsTab,
  membersApi,
} from "@/services/members.service";

export type PeopleTabKey = "all" | "mutual" | "followers" | "following" | "suggested";

const VALID_TABS: readonly PeopleTabKey[] = [
  "all",
  "mutual",
  "followers",
  "following",
  "suggested",
];

function normalizeTab(raw?: string | null): PeopleTabKey {
  if (!raw) return "all";
  const lower = raw.toLowerCase();
  if (lower === "friends") return "all";
  if (VALID_TABS.includes(lower as PeopleTabKey)) return lower as PeopleTabKey;
  return "all";
}

function toggleFollowOnFriend(f: FriendPM): FriendPM {
  return { ...f, isFollowing: !f.isFollowing };
}

function toggleFollowOnCard(c: MemberCardPM): MemberCardPM {
  return {
    ...c,
    isFollowing: !c.isFollowing,
    followersCount: c.isFollowing ? Math.max(0, c.followersCount - 1) : c.followersCount + 1,
  };
}

export function usePeoplePresenter(usernameParam: string, initialTabParam?: string | null) {
  const router = useRouter();
  const username = usernameParam.replace(/^@/, "");

  const [activeTab, setActiveTab] = useState<PeopleTabKey>(() => normalizeTab(initialTabParam));
  const [profile, setProfile] = useState<PublicProfilePM | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [friendsData, setFriendsData] = useState<{
    key: string;
    items: FriendPM[];
    total: number;
    error: string | null;
  } | null>(null);

  const [suggestedData, setSuggestedData] = useState<{
    username: string;
    items: MemberCardPM[];
  } | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rowBusy, setRowBusy] = useState<Set<string>>(new Set());

  // 1. Fetch member public profile
  useEffect(() => {
    let cancelled = false;
    setLoadingProfile(true);
    membersApi
      .profile(username)
      .then((pm) => {
        if (!cancelled) {
          setProfile(pm);
          setProfileError(null);
        }
      })
      .catch((err: { status?: number }) => {
        if (cancelled) return;
        if (err?.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setProfileError(MEMBERS_COPY.common.error);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, router]);

  // 2. Fetch list depending on activeTab
  const listKey = `${username}|${activeTab}`;
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    if (activeTab === "suggested") {
      if (suggestedData?.username === username) return;
      setLoadingList(true);
      membersApi
        .page({
          country: profile.country ?? "NG",
          state: profile.state ?? "",
          region: null,
          page: 1,
          limit: 50,
          sort: "recent",
        })
        .then((res) => {
          if (cancelled) return;
          const sameRegion = (m: MemberCardPM) =>
            Boolean(
              profile.city &&
                m.city &&
                m.city.trim().toLowerCase() === profile.city.trim().toLowerCase(),
            );
          const sorted = res.items
            .filter((m) => m.userId !== profile.userId)
            .sort((a, b) => {
              const aMatch = sameRegion(a) ? 1 : 0;
              const bMatch = sameRegion(b) ? 1 : 0;
              return bMatch - aMatch;
            });
          setSuggestedData({ username, items: sorted });
          setListError(null);
        })
        .catch(() => {
          if (!cancelled) setListError(MEMBERS_COPY.common.error);
        })
        .finally(() => {
          if (!cancelled) setLoadingList(false);
        });
      return;
    }

    // Standard friends / mutual / followers / following
    const apiTab: FriendsTab = activeTab;
    setLoadingList(true);
    membersApi
      .friends(username, apiTab, 1, 50)
      .then((res) => {
        if (cancelled) return;
        setFriendsData({ key: listKey, items: res.items, total: res.total, error: null });
        setListError(null);
      })
      .catch(() => {
        if (!cancelled) setListError(MEMBERS_COPY.common.error);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, activeTab, profile, listKey, suggestedData]);

  const markBusy = (userId: string, busy: boolean) =>
    setRowBusy((prev) => {
      const next = new Set(prev);
      if (busy) next.add(userId);
      else next.delete(userId);
      return next;
    });

  const toggleFriendFollow = useCallback((row: FriendRowVM) => {
    if (!row.username) return;
    const { userId, username: handle, isFollowing } = row;
    markBusy(userId, true);
    setFriendsData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.userId === userId ? toggleFollowOnFriend(i) : i)),
          }
        : prev,
    );
    void (isFollowing ? membersApi.unfollow(handle) : membersApi.follow(handle))
      .catch(() => {
        setFriendsData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((i) => (i.userId === userId ? toggleFollowOnFriend(i) : i)),
              }
            : prev,
        );
      })
      .finally(() => markBusy(userId, false));
  }, []);

  const addSuggested = useCallback((row: FriendRowVM) => {
    if (!row.username) return;
    const { userId, username: handle, isFollowing } = row;
    markBusy(userId, true);
    setSuggestedData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.userId === userId ? toggleFollowOnCard(i) : i)),
          }
        : prev,
    );
    void (isFollowing ? membersApi.unfollow(handle) : membersApi.follow(handle))
      .catch(() => {
        setSuggestedData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((i) => (i.userId === userId ? toggleFollowOnCard(i) : i)),
              }
            : prev,
        );
      })
      .finally(() => markBusy(userId, false));
  }, []);

  const vm = useMemo(() => (profile ? toPublicProfileVM(profile) : null), [profile]);

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

  const rawRows: FriendRowVM[] = useMemo(() => {
    if (activeTab === "suggested") {
      return (suggestedData?.items ?? []).map(toRow);
    }
    return (friendsData?.items ?? []).map(toRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, suggestedData, friendsData, rowBusy]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawRows;
    return rawRows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        (r.handle && r.handle.toLowerCase().includes(q)),
    );
  }, [rawRows, searchQuery]);

  const backHref = vm?.isSelf ? Routes.profile : Routes.member(username);

  const subTabs = [
    {
      key: "all" as const,
      label: MEMBERS_COPY.profile.friends.all(vm?.stats.friends ?? "0"),
      active: activeTab === "all" || activeTab === "mutual",
    },
    {
      key: "followers" as const,
      label: MEMBERS_COPY.profile.friends.followersCount(vm?.stats.followers ?? "0"),
      active: activeTab === "followers",
    },
    {
      key: "following" as const,
      label: MEMBERS_COPY.profile.friends.followingCount(vm?.stats.following ?? "0"),
      active: activeTab === "following",
    },
    {
      key: "suggested" as const,
      label: MEMBERS_COPY.profile.friends.suggested,
      active: activeTab === "suggested",
    },
  ];

  return {
    loading: loadingProfile,
    loadingList,
    error: profileError ?? listError,
    profile: vm,
    displayName: vm?.displayName ?? username,
    handle: vm?.handle ?? `@${username}`,
    backHref,
    activeTab,
    onSelectTab: (t: PeopleTabKey) => setActiveTab(t),
    subTabs,
    searchQuery,
    onSearchChange: setSearchQuery,
    rows: filteredRows,
    counts: {
      friends: vm?.stats.friends ?? "0",
      followers: vm?.stats.followers ?? "0",
      following: vm?.stats.following ?? "0",
      mutualFriends: vm?.stats.mutualFriends ?? "0",
    },
    isSelf: vm?.isSelf ?? false,
    onToggleFollow: activeTab === "suggested" ? addSuggested : toggleFriendFollow,
    labels: {
      follow: MEMBERS_COPY.profile.friends.follow,
      following: MEMBERS_COPY.profile.friends.following,
      searchPlaceholder: "Search kinksters…",
      loading: MEMBERS_COPY.common.loading,
    },
  };
}
