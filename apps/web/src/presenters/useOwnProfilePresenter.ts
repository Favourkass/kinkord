"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import { ApiError } from "@/services/apiClient";
import { profileApi } from "@/services/profile.service";
import { useMemberProfilePresenter } from "./useMemberProfilePresenter";

/**
 * /profile — your own profile in the designed view (Figma 1167:552), reached from the
 * tab-bar avatar and the drawer identity card. Resolves your handle, then renders the
 * same screen a member sees, with the owner's actions.
 */
export function useOwnProfilePresenter(initialTab?: string | null) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void profileApi
      .me()
      .then((me) => {
        if (cancelled) return;
        if (me.username) setUsername(me.username);
        else setError(MEMBERS_COPY.common.error);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setError(MEMBERS_COPY.common.error);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const profile = useMemberProfilePresenter(username, initialTab);
  return {
    ...profile,
    loading: error ? false : profile.loading,
    status: error ?? profile.status,
    activeTab: "profile" as const,
  };
}
