"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/services/authClient";
import { api, ApiError } from "@/services/apiClient";
import { Routes } from "@/constants/Routes";
import type { MeVM, ProfileVM } from "./useProfilePresenter";

interface CommunityStatsVM {
  members: number;
}

/** Post-login home: greeting, drawer identity, live member count. */
export function useHomePresenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vm, setVm] = useState({
    greeting: "Hi there, Welcome",
    name: "",
    handle: "",
    avatarUrl: null as string | null,
    membersCount: "—",
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
        const firstName =
          (me.name ?? profile.displayName ?? me.username ?? "there").trim().split(/\s+/)[0] ||
          "there";
        setVm({
          greeting: `Hi ${firstName}, Welcome`,
          name: profile.displayName || me.username || "",
          handle: me.username ? `@${me.username}` : "",
          avatarUrl: profile.avatarUrl,
          membersCount: String(stats.members),
        });
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

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const logout = useCallback(async () => {
    await authClient.signOut();
    router.push(Routes.login);
  }, [router]);

  return { loading, error, drawerOpen, openDrawer, closeDrawer, logout, ...vm };
}
