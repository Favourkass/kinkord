"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import { toPublicProfileVM, type PublicProfilePM } from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import { decodeParam, membersApi, toggleFollowOnProfile } from "@/services/members.service";

export type ProfileTabKey = "posts" | "about" | "media" | "friends";

/** Outcome of loading one username; keyed so a route change never shows stale data. */
interface ProfileOutcome {
  username: string;
  pm: PublicProfilePM | null;
  notFound: boolean;
  error: string | null;
}

/** Another member's public profile: header + About tab, follow/unfollow, empty tabs. */
export function useMemberProfilePresenter(usernameParam: string) {
  const router = useRouter();
  const copy = MEMBERS_COPY.profile;
  const username = decodeParam(usernameParam).replace(/^@/, "");
  const [outcome, setOutcome] = useState<ProfileOutcome | null>(null);
  const [tab, setTab] = useState<ProfileTabKey>("about");
  const [followBusy, setFollowBusy] = useState(false);

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

  /** Optimistic follow flip; reverts if the API rejects. */
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

  return {
    loading: current === null,
    error: current?.error ?? null,
    notFound: current?.notFound ? copy.notFound : null,
    vm,
    presenceText,
    tab,
    setTab: (key: string) => setTab(key as ProfileTabKey),
    tabs,
    toggleFollow,
    followBusy,
    messageHref: Routes.messages,
    editHref: Routes.profileEdit,
    headerLabels: {
      follow: copy.follow,
      following: copy.following,
      message: copy.message,
      online: copy.online,
      offline: MEMBERS_COPY.region.offline,
      yourself: copy.yourself,
      editProfile: copy.editProfile,
      stats: copy.stats,
    },
    aboutLabels: copy.about,
    emptyCopy: copy.empty,
  };
}
