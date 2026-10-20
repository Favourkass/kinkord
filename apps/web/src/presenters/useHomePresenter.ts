"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { showsVerificationEntry } from "@/domain/bronzeVerification";
import { authClient } from "@/services/authClient";
import { bronzeVerificationApi } from "@/services/bronzeVerification.service";
import { api, ApiError } from "@/services/apiClient";
import { appBadgeService } from "@/services/app-badge.service";
import { pushService } from "@/services/push.service";
import { Routes } from "@/constants/Routes";
import type { MeVM, ProfileVM } from "./useProfilePresenter";
import { useAppBadgePresenter } from "./useAppBadgePresenter";
import { useMessageBadgePresenter } from "./useMessageBadgePresenter";
import { useNotificationCountPresenter } from "./useNotificationBadgePresenter";

interface CommunityStatsVM {
  members: number;
}

/** Post-login home: greeting, drawer identity, live member count. */
export function useHomePresenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const messagesCount = useMessageBadgePresenter(signedIn);
  const notificationsCount = useNotificationCountPresenter(signedIn);
  useAppBadgePresenter(signedIn, messagesCount, notificationsCount);
  const notificationsUnread = notificationsCount > 0;
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vm, setVm] = useState({
    greeting: "Hi there, Welcome",
    name: "",
    handle: "",
    avatarUrl: null as string | null,
    membersCount: "—",
    silver: false,
    /** Whether others see your verified badge; your own profile notes it when they don't. */
    showVerifiedBadge: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [me, profile, stats] = await Promise.all([
          api.get<MeVM & { name?: string | null }>("/me"),
          api.get<ProfileVM>("/profile"),
          api.get<CommunityStatsVM>("/community/stats"),
        ]);
        if (cancelled) return;
        setSignedIn(true);
        const firstName =
          (me.name ?? profile.displayName ?? me.username ?? "there").trim().split(/\s+/)[0] ||
          "there";
        setVm({
          greeting: `Hi ${firstName}, Welcome`,
          name: profile.displayName || me.username || "",
          handle: me.username ? `@${me.username}` : "",
          avatarUrl: profile.avatarUrl,
          membersCount: String(stats.members),
          silver: me.plan === "silver",
          showVerifiedBadge: profile.showVerifiedBadge !== false,
        });
        // Signed in: keep this device's notification subscription current.
        void pushService.sync().catch(() => undefined);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setError("Could not load your home. Refresh to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // The drawer lists Verification only while it's open to the member, as Settings
  // does. It's asked the first time the drawer opens, so other pages don't pay for it.
  const [verificationEntry, setVerificationEntry] = useState(false);
  const askedVerification = useRef(false);
  useEffect(() => {
    if (!drawerOpen || askedVerification.current) return;
    askedVerification.current = true;
    bronzeVerificationApi.status().then(
      (status) => setVerificationEntry(showsVerificationEntry(status)),
      () => undefined,
    );
  }, [drawerOpen]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const logout = useCallback(async () => {
    setSignedIn(false);
    await appBadgeService.clear();
    // While still signed in, so the API forgets this device for this member.
    await pushService.forgetDevice();
    await authClient.signOut();
    router.push(Routes.login);
  }, [router]);

  return {
    loading,
    error,
    drawerOpen,
    verificationEntry,
    openDrawer,
    closeDrawer,
    logout,
    notificationsUnread,
    notificationsCount,
    messagesCount,
    signedIn,
    ...vm,
  };
}
