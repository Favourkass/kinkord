"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import {
  toMediaTiles,
  toPublicProfileVM,
  type FriendRowVM,
  type MediaItemPM,
  type MediaTileVM,
  type PublicProfilePM,
} from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import {
  decodeParam,
  membersApi,
  toggleFollowOnFriend,
  toggleFollowOnProfile,
  type FriendPM,
  type FriendsTab,
  type MediaFilter,
} from "@/services/members.service";

export type ProfileTabKey = "posts" | "about" | "media" | "people";

const TAB_KEYS: ProfileTabKey[] = ["posts", "about", "media", "people"];
const isTabKey = (v: string | null | undefined): v is ProfileTabKey =>
  TAB_KEYS.includes(v as ProfileTabKey);
const PEOPLE_TABS: FriendsTab[] = ["all", "followers", "following", "suggested"];
const MEDIA_FILTERS: MediaFilter[] = ["all", "profile", "photos", "videos"];

/** Outcome of loading one username; keyed so a route change never shows stale data. */
interface ProfileOutcome {
  username: string;
  pm: PublicProfilePM | null;
  notFound: boolean;
  error: string | null;
}

/** One People sub-tab's rows, keyed by (username, sub-tab). */
interface PeopleOutcome {
  key: string;
  items: FriendPM[];
  total: number;
  error: string | null;
}

/** One Media pill's tiles, keyed by (username, filter). */
interface MediaOutcome {
  key: string;
  items: MediaItemPM[];
  total: number;
  error: string | null;
}

/** Desktop "Suggested Friends" (right column), keyed by username. */
interface SuggestOutcome {
  username: string;
  items: FriendPM[];
}

interface LightboxState {
  id: string;
  confirming: boolean;
  deleting: boolean;
}

/** Rows shown inside the tab before "See more" (Figma 1319:672 shows five). */
const PEOPLE_PREVIEW = 5;
const MEDIA_PAGE = 60;
const SUGGESTIONS = 3;

/**
 * A member's profile — yours at /profile (pass your own handle) or theirs at /u/[username].
 * Figma 1167:552 / 1202:242 / 1256:800 / 1321:14 / 1524:1786: hero, tabs, About cards,
 * Media grid + lightbox (delete your own), People sub-tabs, posts (next slice).
 * `usernameParam` null = still resolving who you are; nothing loads until it is known.
 */
export function useMemberProfilePresenter(
  usernameParam: string | null,
  initialTab?: string | null,
) {
  const router = useRouter();
  const copy = MEMBERS_COPY.profile;
  const username = usernameParam ? decodeParam(usernameParam).replace(/^@/, "") : null;
  const [outcome, setOutcome] = useState<ProfileOutcome | null>(null);
  // Deep-linkable via ?tab=…; About stays the default until posts land.
  const [tab, setTab] = useState<ProfileTabKey>(isTabKey(initialTab) ? initialTab : "about");
  const [followBusy, setFollowBusy] = useState(false);
  const [peopleTab, setPeopleTab] = useState<FriendsTab>("all");
  const [people, setPeople] = useState<PeopleOutcome | null>(null);
  const [suggested, setSuggested] = useState<SuggestOutcome | null>(null);
  const [rowBusy, setRowBusy] = useState<ReadonlySet<string>>(new Set());
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [media, setMedia] = useState<MediaOutcome | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  // Only an outcome for the *current* username counts; anything else means "loading".
  const current = username && outcome?.username === username ? outcome : null;
  const pm = current?.pm ?? null;

  useEffect(() => {
    if (!username) return;
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

  // People rows load lazily, when the tab is open, per (username, sub-tab) key.
  const peopleKey = `${username}|${peopleTab}`;
  const currentPeople = people?.key === peopleKey ? people : null;
  useEffect(() => {
    if (tab !== "people" || !username || !pm || currentPeople) return;
    let cancelled = false;
    void membersApi
      .friends(username, peopleTab, 1, PEOPLE_PREVIEW)
      .then((res) => {
        if (!cancelled)
          setPeople({ key: peopleKey, items: res.items, total: res.total, error: null });
      })
      .catch(() => {
        if (!cancelled)
          setPeople({ key: peopleKey, items: [], total: 0, error: MEMBERS_COPY.common.error });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, pm, currentPeople, username, peopleTab, peopleKey]);

  // Media tiles load lazily, when the tab is open, per (username, pill) key.
  const mediaKey = `${username}|${mediaFilter}`;
  const currentMedia = media?.key === mediaKey ? media : null;
  useEffect(() => {
    if (tab !== "media" || !username || !pm || currentMedia) return;
    let cancelled = false;
    void membersApi
      .media(username, mediaFilter, 1, MEDIA_PAGE)
      .then((res) => {
        if (!cancelled)
          setMedia({ key: mediaKey, items: res.items, total: res.total, error: null });
      })
      .catch(() => {
        if (!cancelled)
          setMedia({ key: mediaKey, items: [], total: 0, error: MEMBERS_COPY.common.error });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, pm, currentMedia, username, mediaFilter, mediaKey]);

  // Desktop right column: suggested kinksters (same state, own area first). Best effort.
  const currentSuggested = suggested?.username === username ? suggested : null;
  useEffect(() => {
    if (!username || !pm || currentSuggested) return;
    let cancelled = false;
    void membersApi
      .friends(username, "suggested", 1, SUGGESTIONS)
      .then((res) => {
        if (!cancelled) setSuggested({ username, items: res.items });
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

  /** Optimistic follow flip on a People row. */
  const togglePersonFollow = useCallback((row: FriendRowVM) => {
    if (!row.username) return;
    const { userId, username: handle, isFollowing } = row;
    const flip = (f: PeopleOutcome | null) =>
      f
        ? { ...f, items: f.items.map((i) => (i.userId === userId ? toggleFollowOnFriend(i) : i)) }
        : f;
    markBusy(userId, true);
    setPeople(flip);
    void (isFollowing ? membersApi.unfollow(handle) : membersApi.follow(handle))
      .catch(() => setPeople(flip))
      .finally(() => markBusy(userId, false));
  }, []);

  /** "Add" on a suggested friend = follow (optimistic, reverts on failure). */
  const addSuggested = useCallback((row: FriendRowVM) => {
    if (!row.username) return;
    const { userId, username: handle, isFollowing } = row;
    const flip = (s: SuggestOutcome | null) =>
      s
        ? { ...s, items: s.items.map((i) => (i.userId === userId ? toggleFollowOnFriend(i) : i)) }
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

  /** Lightbox: open, ask, delete (own photos only). */
  const openMedia = useCallback(
    (tile: MediaTileVM) => setLightbox({ id: tile.id, confirming: false, deleting: false }),
    [],
  );
  const closeMedia = useCallback(() => setLightbox(null), []);
  const requestDelete = useCallback(
    () => setLightbox((l) => (l ? { ...l, confirming: true } : l)),
    [],
  );
  const cancelDelete = useCallback(
    () => setLightbox((l) => (l ? { ...l, confirming: false } : l)),
    [],
  );
  const confirmDelete = useCallback(() => {
    if (!lightbox || !pm?.isSelf) return;
    const { id } = lightbox;
    setLightbox({ ...lightbox, deleting: true });
    void membersApi
      .deleteMedia(id)
      .then((res) => {
        setMedia((m) =>
          m
            ? { ...m, items: m.items.filter((i) => i.id !== id), total: Math.max(0, m.total - 1) }
            : m,
        );
        // Deleting the photo in use falls the header back to the placeholder.
        setOutcome((o) =>
          o?.pm
            ? {
                ...o,
                pm: { ...o.pm, avatarUrl: res.profile.avatarUrl, coverUrl: res.profile.coverUrl },
              }
            : o,
        );
        setLightbox(null);
      })
      .catch(() => setLightbox((l) => (l ? { ...l, deleting: false, confirming: false } : l)));
  }, [lightbox, pm]);

  const vm = useMemo(() => (pm ? toPublicProfileVM(pm) : null), [pm]);
  const presenceText = vm
    ? vm.isOnline
      ? copy.online
      : vm.lastSeenAgo
        ? copy.lastSeen(vm.lastSeenAgo)
        : null
    : null;

  const tabs = TAB_KEYS.map((key) => ({ key, label: copy.tabs[key] }));

  const toRow = (f: FriendPM): FriendRowVM => ({
    userId: f.userId,
    username: f.username,
    displayName: f.displayName,
    handle: f.username ? `@${f.username}` : null,
    avatarUrl: f.avatarUrl,
    isFollowing: f.isFollowing,
    busy: rowBusy.has(f.userId),
  });
  const peopleRows = useMemo(
    () =>
      (currentPeople?.items ?? []).map((f) => ({
        ...toRow(f),
        href: Routes.member(f.username ?? f.userId),
        // Your own friends list shows the "Friends" pill; everywhere else a Follow button.
        pill: Boolean(pm?.isSelf) && peopleTab === "all",
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPeople, rowBusy, pm?.isSelf, peopleTab],
  );
  const suggestedRows = useMemo<FriendRowVM[]>(
    () => (currentSuggested?.items ?? []).map(toRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentSuggested, rowBusy],
  );
  const tiles = useMemo(() => toMediaTiles(currentMedia?.items ?? []), [currentMedia]);
  const lightboxTile = lightbox ? (tiles.find((t) => t.id === lightbox.id) ?? null) : null;

  const stats = vm?.stats;
  const peopleLabel = (key: FriendsTab) =>
    key === "all"
      ? copy.people.tabs.all(stats?.friends ?? "0")
      : key === "followers"
        ? copy.people.tabs.followers(stats?.followers ?? "0")
        : key === "following"
          ? copy.people.tabs.following(stats?.following ?? "0")
          : key === "mutual"
            ? copy.people.tabs.mutual(stats?.mutualFriends ?? "0")
            : copy.people.tabs.suggested;

  return {
    loading: username === null || current === null,
    error: current?.error ?? null,
    notFound: current?.notFound ? copy.notFound : null,
    status: current?.notFound ? copy.notFound : (current?.error ?? null),
    loadingText: MEMBERS_COPY.common.loading,
    vm,
    presenceText,
    activeTab: pm?.isSelf ? ("profile" as const) : undefined,
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
    setTab: (key: string) => {
      if (isTabKey(key)) setTab(key);
    },
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
      addToStory: copy.addToStory,
      gift: copy.gift,
      comingSoon: copy.comingSoon,
      stats: copy.stats,
    },
    sideLabels: {
      follow: copy.follow,
      following: copy.following,
      message: copy.message,
      yourself: copy.yourself,
      editProfile: copy.editProfile,
      tagsHeading: copy.desktop.tagsHeading,
      stats: copy.stats,
    },
    aboutLabels: copy.about,
    people: {
      subTabs: PEOPLE_TABS.map((key) => ({
        key,
        label: peopleLabel(key),
        active: peopleTab === key,
      })),
      onSubTab: (key: string) => {
        if (PEOPLE_TABS.includes(key as FriendsTab)) setPeopleTab(key as FriendsTab);
      },
      rows: peopleRows,
      labels: {
        follow: copy.people.follow,
        following: copy.people.following,
        friendsPill: copy.people.friendsPill,
        more: copy.people.more,
      },
      onToggleFollow: togglePersonFollow,
      loading: tab === "people" && pm !== null && currentPeople === null,
      loadingText: MEMBERS_COPY.common.loading,
      empty:
        currentPeople && currentPeople.items.length === 0 && !currentPeople.error
          ? copy.people.empty[peopleTab]
          : null,
      error: currentPeople?.error ?? null,
      seeMoreHref:
        pm?.username && currentPeople && currentPeople.total > PEOPLE_PREVIEW
          ? Routes.memberPeople(pm.username, peopleTab)
          : null,
      seeMoreLabel: copy.people.seeMore,
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
      countLabel: copy.media.count(currentMedia?.total ?? 0),
      filters: MEDIA_FILTERS.map((key) => ({
        key,
        label: copy.media.filters[key],
        active: mediaFilter === key,
      })),
      onFilter: (key: string) => {
        if (MEDIA_FILTERS.includes(key as MediaFilter)) setMediaFilter(key as MediaFilter);
      },
      tiles,
      featuredLabel: copy.media.featured,
      emptyText: currentMedia?.error ?? copy.media.empty,
      loading: tab === "media" && pm !== null && currentMedia === null,
      loadingText: MEMBERS_COPY.common.loading,
      onOpen: openMedia,
      lightbox: lightboxTile
        ? {
            tile: lightboxTile,
            canDelete: Boolean(pm?.isSelf),
            confirming: lightbox?.confirming ?? false,
            deleting: lightbox?.deleting ?? false,
          }
        : null,
      lightboxLabels: copy.media.lightbox,
      onClose: closeMedia,
      onDelete: requestDelete,
      onConfirmDelete: confirmDelete,
      onCancelDelete: cancelDelete,
    },
  };
}
