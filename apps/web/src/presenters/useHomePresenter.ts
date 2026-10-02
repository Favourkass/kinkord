"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/services/authClient";
import { api, ApiError } from "@/services/apiClient";
import { pushService } from "@/services/push.service";
import { Routes } from "@/constants/Routes";
import type { MeVM, ProfileVM } from "./useProfilePresenter";
import type { KycProgressPM } from "@/domain/kyc";

interface CommunityStatsVM {
  members: number;
}

const settingsDrawerRoutes = new Set<string>([
  Routes.settings,
  Routes.settingsSecurity,
  Routes.settingsKyc,
  Routes.settingsData,
  Routes.settingsContent,
  Routes.settingsCommunitySafety,
  Routes.profileEditPrivacy,
  Routes.contact,
  Routes.about,
]);

export function isSettingsDrawerPath(pathname: string) {
  return settingsDrawerRoutes.has(pathname) || pathname.startsWith(`${Routes.settings}/`);
}

/** Post-login home: greeting, drawer identity, live member count. */
export function useHomePresenter() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(() => isSettingsDrawerPath(pathname));
  const [vm, setVm] = useState({
    greeting: "Hi there, Welcome",
    name: "",
    handle: "",
    avatarUrl: null as string | null,
    kycVerified: false,
    membersCount: "—",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [me, profile, stats, kyc] = await Promise.all([
          api.get<MeVM & { name?: string | null }>("/me"),
          api.get<ProfileVM>("/profile"),
          api.get<CommunityStatsVM>("/community/stats"),
          api.get<KycProgressPM>("/verification/kyc/status").catch(() => null),
        ]);
        if (cancelled) return;
        const firstName =
          (me.name ?? profile.displayName ?? me.username ?? "there").trim().split(/\s+/)[0] ||
          "there";
        setVm({
          greeting: `Hi ${firstName}, Welcome`,
          name: profile.displayName || me.username || "",
          handle: me.username ? `@${me.username}` : "",
          avatarUrl: profile.avatarUrl,
          kycVerified: Boolean(kyc?.fullKycVerified),
          membersCount: String(stats.members),
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

  useEffect(() => {
    if (isSettingsDrawerPath(pathname)) setSettingsMenuOpen(true);
  }, [pathname]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleSettingsMenu = useCallback(() => setSettingsMenuOpen((open) => !open), []);

  const logout = useCallback(async () => {
    // While still signed in, so the API forgets this device for this member.
    await pushService.forgetDevice();
    await authClient.signOut();
    router.push(Routes.login);
  }, [router]);

  return {
    loading,
    error,
    drawerOpen,
    settingsMenuOpen,
    openDrawer,
    closeDrawer,
    toggleSettingsMenu,
    logout,
    ...vm,
  };
}
