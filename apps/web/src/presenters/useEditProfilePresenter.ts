"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/services/authClient";
import { api, ApiError, uploadToPresignedUrl } from "@/services/apiClient";
import { Routes } from "@/constants/Routes";
import type { MeVM, ProfileVM } from "./useProfilePresenter";

export interface EditProfileFields {
  displayName: string;
  username: string;
  gender: string;
  relationshipStatus: string;
  role: string;
  lookingFor: string;
  interests: string;
  address: string;
}

const splitList = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const emptyFields: EditProfileFields = {
  displayName: "",
  username: "",
  gender: "",
  relationshipStatus: "",
  role: "",
  lookingFor: "",
  interests: "",
  address: "",
};

/** Edit-profile screen: text persona fields + avatar/cover uploads. */
export function useEditProfilePresenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initialUsername, setInitialUsername] = useState("");
  const [fields, setFields] = useState<EditProfileFields>(emptyFields);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [me, profile] = await Promise.all([
          api.get<MeVM>("/me"),
          api.get<ProfileVM>("/profile"),
        ]);
        if (cancelled) return;
        const username = me.username ?? "";
        setInitialUsername(username);
        setAvatarUrl(profile.avatarUrl);
        setFields({
          displayName: profile.displayName ?? "",
          username: username ? `@${username}` : "",
          gender: profile.gender ?? "",
          relationshipStatus: profile.relationshipStatus ?? "",
          role: (profile.roles ?? []).join(", "),
          lookingFor: (profile.lookingFor ?? []).join(", "),
          interests: (profile.interests ?? []).join(", "),
          address: profile.location ?? "",
        });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setError("Could not load your profile. Refresh to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const setField = useCallback((key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setNotice(null);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const nextUsername = fields.username.trim().replace(/^@/, "").toLowerCase();
      if (nextUsername && nextUsername !== initialUsername) {
        const { error: err } = await authClient.updateUser({ username: nextUsername });
        if (err) throw new Error(err.message ?? "Could not update username");
        setInitialUsername(nextUsername);
      }
      await api.patch<ProfileVM>("/profile", {
        displayName: fields.displayName.trim(),
        gender: fields.gender.trim() || null,
        relationshipStatus: fields.relationshipStatus.trim() || null,
        roles: splitList(fields.role),
        lookingFor: splitList(fields.lookingFor),
        interests: splitList(fields.interests),
        location: fields.address.trim() || null,
      });
      setNotice("Profile saved.");
    } catch (e) {
      setError(
        e instanceof ApiError && typeof e.body === "object" && e.body
          ? Object.values(e.body as Record<string, unknown>)
              .flat()
              .join(" ")
          : e instanceof Error
            ? e.message
            : "Could not save. Check your details.",
      );
    } finally {
      setSaving(false);
    }
  }, [fields, initialUsername]);

  const uploadImage = useCallback(async (kind: "avatar" | "cover", file: File) => {
    setUploading(true);
    setError(null);
    try {
      const spec = await api.post<{ key: string; uploadUrl: string; maxSizeMb: number }>(
        "/profile/upload-url",
        { kind, contentType: file.type },
      );
      if (file.size > spec.maxSizeMb * 1024 * 1024)
        throw new Error(`Image is too large — max ${spec.maxSizeMb}MB.`);
      await uploadToPresignedUrl(spec.uploadUrl, file);
      const vm = await api.patch<ProfileVM>(
        "/profile",
        kind === "avatar" ? { avatarKey: spec.key } : { coverKey: spec.key },
      );
      if (kind === "avatar") setAvatarUrl(vm.avatarUrl);
      setNotice(kind === "avatar" ? "Profile photo updated." : "Cover photo updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  const back = useCallback(() => router.back(), [router]);

  const logout = useCallback(async () => {
    await authClient.signOut();
    router.push(Routes.login);
  }, [router]);

  return {
    loading,
    saving,
    uploading,
    notice,
    error,
    avatarUrl,
    fields,
    setField,
    save,
    uploadImage,
    back,
    logout,
  };
}
