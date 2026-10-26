"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { NOTIFICATION_SETTINGS_COPY as COPY } from "@/constants/notificationSettings";
import { Routes } from "@/constants/Routes";
import type { PushGroup, PushPreferencesPM } from "@/domain/pushPreferences";
import { loadPushPreferences, savePushPreference } from "@/services/pushPreferencesService";

export function useNotificationSettingsPresenter() {
  const [model, setModel] = useState<PushPreferencesPM | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PushGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const live = useRef(true);

  const load = useCallback(async () => {
    try {
      const result = await loadPushPreferences();
      if (live.current) {
        setModel(result);
        setError(null);
      }
    } catch {
      if (live.current) setError(COPY.loadError);
    } finally {
      if (live.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    live.current = true;
    void Promise.resolve().then(load);
    return () => {
      live.current = false;
    };
  }, [load]);

  const toggle = async (group: PushGroup) => {
    if (!model || saving) return;
    setSaving(group);
    setError(null);
    setNotice(null);
    try {
      const result = await savePushPreference(group, !model.settings[group]);
      if (live.current) {
        setModel(result);
        setNotice(COPY.saved);
      }
    } catch {
      if (live.current) setError(COPY.saveError);
    } finally {
      if (live.current) setSaving(null);
    }
  };

  return {
    title: COPY.title,
    backLabel: COPY.back,
    backHref: Routes.settings,
    description: COPY.description,
    rhythm: COPY.rhythm,
    loadingLabel: COPY.loading,
    retryLabel: COPY.retry,
    loading,
    error,
    notice,
    onRetry: () => {
      setLoading(true);
      void load();
    },
    rows: COPY.groups.map((group) => ({
      key: group.key,
      label: group.label,
      hint: group.hint,
      on: model?.settings[group.key] ?? true,
      busy: saving === group.key,
      disabled: !model || saving !== null,
      onToggle: () => {
        void toggle(group.key);
      },
    })),
  };
}
