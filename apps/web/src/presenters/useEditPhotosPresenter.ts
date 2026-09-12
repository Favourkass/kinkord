"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_EDIT_COPY } from "@/constants/profileEdit";
import { Routes } from "@/constants/Routes";
import type { OwnProfilePM } from "@/domain/profile";
import { ApiError } from "@/services/apiClient";
import { profileApi, uploadProfileImage, type ImageKind } from "@/services/profile.service";

/** Server-side caps (apps/api UPLOAD_KINDS) surfaced as hints; the API still enforces them. */
const MAX_MB: Record<ImageKind, number> = { avatar: 5, cover: 10 };

/** Photos & Media: change the profile photo or the cover. */
export function useEditPhotosPresenter() {
  const router = useRouter();
  const copy = PROFILE_EDIT_COPY;
  const [profile, setProfile] = useState<OwnProfilePM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState<ImageKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    void profileApi
      .own()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setError(copy.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, copy.loadError]);

  const upload = useCallback(
    async (kind: ImageKind, file: File) => {
      setUploading(kind);
      setError(null);
      setNotice(null);
      try {
        setProfile(await uploadProfileImage(kind, file));
        setNotice(kind === "avatar" ? copy.photos.savedAvatar : copy.photos.savedCover);
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.uploadError);
      } finally {
        setUploading(null);
      }
    },
    [copy],
  );

  const card = (kind: ImageKind) => {
    const c = copy.photos[kind];
    return {
      title: c.title,
      subtitle: c.subtitle,
      hint: copy.photos.hint(MAX_MB[kind]),
      actionLabel: c.action,
      changeLabel: c.change,
      url: kind === "avatar" ? (profile?.avatarUrl ?? null) : (profile?.coverUrl ?? null),
      uploading: uploading === kind,
      uploadingLabel: copy.photos.uploading,
    };
  };

  return {
    loading,
    error,
    notice,
    title: copy.title,
    backLabel: copy.back,
    loadingLabel: copy.loading,
    heading: copy.photos.heading,
    subtitle: copy.photos.subtitle,
    avatar: card("avatar"),
    cover: card("cover"),
    onAvatarFile: (file: File) => {
      void upload("avatar", file);
    },
    onCoverFile: (file: File) => {
      void upload("cover", file);
    },
    back: () => router.push(Routes.profileEdit),
  };
}
