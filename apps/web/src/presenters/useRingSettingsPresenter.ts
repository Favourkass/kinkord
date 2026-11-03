"use client";

import { useCallback, useEffect, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { ringCountsFrom, type RingSettingsPM } from "@/domain/kinkRings";
import { kinkRingsAdminApi } from "@/services/kinkRings.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

type Plan = "monthly" | "yearly";

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/**
 * How many Kink Rings each Silver plan brings (Moderation → Kink Rings).
 * Every admin sees it; the founders alone can change it.
 */
export function useRingSettingsPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.ringSettings;
  const [settings, setSettings] = useState<RingSettingsPM | null>(null);
  const [form, setForm] = useState<Record<Plan, string>>({ monthly: "", yearly: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    kinkRingsAdminApi.settings().then(
      (s) => live && setSettings(s),
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin]);

  const save = useCallback(async () => {
    if (!settings) return;
    const rings = ringCountsFrom(form, settings.max);
    if (!rings) {
      setError(copy.invalid(settings.max));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setSettings(await kinkRingsAdminApi.saveSettings(rings));
      setEditing(false);
      setNotice(copy.saved);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSaving(false);
    }
  }, [copy, form, settings]);

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    card: {
      title: copy.title,
      hint: copy.hint,
      loading: access.isAdmin && !settings && !error ? copy.loading : null,
      locked: settings && !settings.canEdit ? copy.locked : null,
      plans: settings
        ? [
            { key: "monthly", label: copy.monthly, value: copy.rings(settings.rings.monthly) },
            { key: "yearly", label: copy.yearly, value: copy.rings(settings.rings.yearly) },
          ]
        : [],
      canEdit: (settings?.canEdit ?? false) && !editing,
      editing,
      form,
      onField: (plan: Plan, value: string) => setForm((f) => ({ ...f, [plan]: value })),
      onEdit: () => {
        if (!settings) return;
        setForm({
          monthly: String(settings.rings.monthly),
          yearly: String(settings.rings.yearly),
        });
        setEditing(true);
        setNotice(null);
        setError(null);
      },
      onCancel: () => {
        setEditing(false);
        setError(null);
      },
      saving,
      onSave: () => void save(),
      error,
      notice,
      labels: {
        edit: copy.edit,
        save: copy.save,
        saving: copy.saving,
        cancel: copy.cancel,
        monthly: copy.monthly,
        yearly: copy.yearly,
      },
    },
  };
}

export type RingSettingsCardVM = ReturnType<typeof useRingSettingsPresenter>["card"];
