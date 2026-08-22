"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { authClient } from "@/services/authClient";
import { api, ApiError, uploadToPresignedUrl } from "@/services/apiClient";
import { Routes } from "@/constants/Routes";

export interface MeVM {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  displayUsername: string | null;
  twoFactorEnabled: boolean;
}

export interface ProfileVM {
  displayName: string;
  bio: string | null;
  pronouns: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  roles: string[];
  phone: string | null;
  phoneVerified: boolean;
  avatarUrl: string | null;
  coverUrl: string | null;
}

export function useProfilePresenter() {
  const router = useRouter();
  const [me, setMe] = useState<MeVM | null>(null);
  const [profile, setProfile] = useState<ProfileVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // edit buffer (feature 005)
  const [edit, setEdit] = useState({ displayName: "", bio: "", pronouns: "", state: "", city: "" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [meRes, profRes] = await Promise.all([
          api.get<MeVM>("/me"),
          api.get<ProfileVM>("/profile"),
        ]);
        if (cancelled) return;
        setMe(meRes);
        setProfile(profRes);
        setEdit({
          displayName: profRes.displayName ?? "",
          bio: profRes.bio ?? "",
          pronouns: profRes.pronouns ?? "",
          state: profRes.state ?? "",
          city: profRes.city ?? "",
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

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const vm = await api.patch<ProfileVM>("/profile", {
        displayName: edit.displayName.trim(),
        bio: edit.bio.trim() || null,
        pronouns: edit.pronouns.trim() || null,
        state: edit.state.trim() || null,
        city: edit.city.trim() || null,
      });
      setProfile(vm);
      setNotice("Profile saved.");
    } catch (e) {
      setError(
        e instanceof ApiError && typeof e.body === "object" && e.body
          ? Object.values(e.body as Record<string, unknown>)
              .flat()
              .join(" ")
          : "Could not save. Check your details.",
      );
    } finally {
      setSaving(false);
    }
  }, [edit]);

  const uploadImage = useCallback(async (kind: "avatar" | "cover", file: File) => {
    setUploading(kind);
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
      setProfile(vm);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    router.push(Routes.login);
  }, [router]);

  return {
    me,
    profile,
    loading,
    saving,
    uploading,
    notice,
    error,
    edit,
    setEdit,
    save,
    uploadImage,
    signOut,
  };
}

/** Security section: TOTP 2FA lifecycle + change password (feature 006). */
export function useSecurityPresenter(onTwoFactorChange?: (enabled: boolean) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ qrDataUrl: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");

  const beginEnable = useCallback(async (password: string) => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await authClient.twoFactor.enable({ password });
      if (err || !data || !("totpURI" in data)) {
        throw new Error(err?.message ?? "Could not start 2FA setup");
      }
      const qrDataUrl = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 });
      setSetup({ qrDataUrl, backupCodes: data.backupCodes ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start 2FA setup.");
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmEnable = useCallback(async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.twoFactor.verifyTotp({ code });
      if (err) throw new Error(err.message ?? "Invalid code");
      setSetup(null);
      setCode("");
      setNotice("Two-factor authentication is on.");
      onTwoFactorChange?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code. Try again.");
    } finally {
      setBusy(false);
    }
  }, [code, onTwoFactorChange]);

  const disable = useCallback(
    async (password: string) => {
      setBusy(true);
      setError(null);
      try {
        const { error: err } = await authClient.twoFactor.disable({ password });
        if (err) throw new Error(err.message ?? "Could not turn off 2FA");
        setNotice("Two-factor authentication is off.");
        onTwoFactorChange?.(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not turn off 2FA.");
      } finally {
        setBusy(false);
      }
    },
    [onTwoFactorChange],
  );

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (newPassword.length < 10 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("New password: at least 10 characters with letters and numbers.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (err) throw new Error(err.message ?? "Could not change password");
      setNotice("Password changed. Other sessions were signed out.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    busy,
    error,
    notice,
    setup,
    code,
    setCode,
    beginEnable,
    confirmEnable,
    disable,
    changePassword,
  };
}
