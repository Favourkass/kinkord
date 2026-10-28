"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PRIVACY_AUDIENCES,
  PRIVACY_CATEGORIES,
  PRIVACY_COPY,
  PRIVACY_FIELDS,
  READ_RECEIPTS_DESCRIPTION,
} from "@/constants/privacy";
import { Routes } from "@/constants/Routes";
import type { PrivacyField, PrivacyPM } from "@/domain/privacy";
import { loadPrivacy, savePrivacy, selectableAudiences } from "@/services/privacyService";

export function usePrivacyPresenter(categoryKey: string) {
  const [model, setModel] = useState<PrivacyPM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<PrivacyField | null>(null);
  const busy = useRef(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    const request = ++version.current;
    try {
      const result = await loadPrivacy();
      if (request === version.current) {
        setModel(result);
        setError(null);
      }
    } catch {
      if (request === version.current)
        setError("Could not load privacy settings. Please try again.");
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, []);
  const invalidate = useCallback(() => {
    ++version.current;
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      invalidate();
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, invalidate]);
  const change = async (field: PrivacyField, audience: string) => {
    if (busy.current) return;
    busy.current = true;
    ++version.current;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await savePrivacy(field, audience);
      setModel(result);
      setExpanded(null);
      setNotice("Privacy setting saved.");
    } catch {
      setError("Could not save this change. Your previous audience is still selected. Try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const category = PRIVACY_CATEGORIES.find((item) => item.key === categoryKey);
  const keys: Partial<Record<string, readonly PrivacyField[]>> = {
    activity: ["onlineStatus"],
    messaging: ["messaging"],
    "read-receipts": ["readReceipts"],
    tagging: ["tagging"],
    sharing: ["sharedContent"],
  };
  const fields =
    categoryKey === "profile"
      ? PRIVACY_FIELDS.filter(
          (item) => !["tagging", "readReceipts", "messaging"].includes(item.key),
        )
      : PRIVACY_FIELDS.filter((item) => keys[categoryKey]?.includes(item.key));
  return {
    title: category?.label ?? "Privacy",
    backHref: Routes.settingsPrivacy,
    loading,
    saving,
    error,
    notice,
    onRetry: () => {
      setLoading(true);
      void refresh();
    },
    description:
      categoryKey === "read-receipts"
        ? READ_RECEIPTS_DESCRIPTION
        : categoryKey === "messaging"
          ? PRIVACY_COPY.messagingDescription
          : categoryKey === "activity"
            ? PRIVACY_COPY.activityDescription
            : fields.length
              ? PRIVACY_COPY.description
              : PRIVACY_COPY.comingSoon,
    fields: fields.map((field) => ({
      ...field,
      hint: PRIVACY_COPY.hints[field.key] ?? null,
      unavailable: "unavailable" in field && field.unavailable,
      audienceLabel:
        PRIVACY_AUDIENCES.find((item) => item.value === model?.settings[field.key])?.label ?? "",
      expanded: expanded === field.key,
      onToggle: () => setExpanded((current) => (current === field.key ? null : field.key)),
      options: selectableAudiences().map((option) => ({
        ...option,
        selected: model?.settings[field.key] === option.value,
        onSelect: () => {
          void change(field.key, option.value);
        },
      })),
    })),
  };
}
