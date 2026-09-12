"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_EDIT_COPY, SECTION_ICONS } from "@/constants/profileEdit";
import { Routes } from "@/constants/Routes";
import type { MePM, OwnProfilePM } from "@/domain/profile";
import { ApiError } from "@/services/apiClient";
import { profileApi, uploadProfileImage } from "@/services/profile.service";

/** The five sections, in Figma order (1542:225). */
const HUB_SECTIONS = [
  { key: "photos", href: Routes.profileEditPhotos },
  { key: "basic", href: Routes.profileEditBasic },
  { key: "kinks", href: Routes.profileEditKinks },
  { key: "location", href: Routes.profileEditLocation },
  { key: "privacy", href: Routes.profileEditPrivacy },
] as const;

/** Edit Profile hub: identity header (avatar change) + links into the five sections. */
export function useEditProfileHubPresenter() {
  const router = useRouter();
  const copy = PROFILE_EDIT_COPY;
  const [me, setMe] = useState<MePM | null>(null);
  const [profile, setProfile] = useState<OwnProfilePM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [m, p] = await Promise.all([profileApi.me(), profileApi.own()]);
        if (cancelled) return;
        setMe(m);
        setProfile(p);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setError(copy.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, copy.loadError]);

  const onAvatarFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setNotice(null);
      try {
        setProfile(await uploadProfileImage("avatar", file));
        setNotice(copy.photos.savedAvatar);
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.uploadError);
      } finally {
        setUploading(false);
      }
    },
    [copy],
  );

  const back = useCallback(() => router.push(Routes.profile), [router]);
  const handle = me?.displayUsername ?? me?.username ?? null;

  return {
    loading,
    error,
    notice,
    uploading,
    title: copy.title,
    backLabel: copy.back,
    loadingLabel: copy.loading,
    subtitle: copy.hub.subtitle,
    avatarUrl: profile?.avatarUrl ?? null,
    name: profile?.displayName ?? "",
    handle: handle ? `· @${handle}` : null,
    tierLabel: copy.hub.tier,
    changePhotoLabel: copy.hub.changePhoto,
    rows: HUB_SECTIONS.map((s) => ({
      key: s.key,
      href: s.href,
      icon: SECTION_ICONS[s.key],
      title: copy.hub.sections[s.key].title,
      subtitle: copy.hub.sections[s.key].subtitle,
    })),
    onAvatarFile: (file: File) => {
      void onAvatarFile(file);
    },
    back,
  };
}
