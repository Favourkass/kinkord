"use client";

import { useCallback, useEffect, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { pairPriceFrom, ringCountsFrom, type RingSettingsPM } from "@/domain/kinkRings";
import { usd } from "@/domain/subscription";
import { kinkRingsAdminApi } from "@/services/kinkRings.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

/** The two plans' counts, and the price of 2 bought rings in dollars. */
type Field = "monthly" | "yearly" | "price";

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/**
 * How many Kink Rings each Silver plan brings, and what 2 bought rings cost
 * (Moderation → Kink Rings). Every admin sees them; the founders alone can
 * change them.
 */
export function useRingSettingsPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.ringSettings;
  const [settings, setSettings] = useState<RingSettingsPM | null>(null);
  const [form, setForm] = useState<Record<Field, string>>({ monthly: "", yearly: "", price: "" });
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
    // An API from before the price existed gets the counts alone.
    const priced = settings.pairUsdCents !== undefined;
    const pairUsdCents = priced ? pairPriceFrom(form.price) : null;
    if (priced && pairUsdCents === null) {
      setError(copy.invalidPrice);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setSettings(
        await kinkRingsAdminApi.saveSettings(
          pairUsdCents === null ? rings : { ...rings, pairUsdCents },
        ),
      );
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
            ...(settings.pairUsdCents !== undefined
              ? [{ key: "price", label: copy.price, value: usd(settings.pairUsdCents) }]
              : []),
          ]
        : [],
      showPrice: settings?.pairUsdCents !== undefined,
      canEdit: (settings?.canEdit ?? false) && !editing,
      editing,
      form,
      onField: (field: Field, value: string) => setForm((f) => ({ ...f, [field]: value })),
      onEdit: () => {
        if (!settings) return;
        setForm({
          monthly: String(settings.rings.monthly),
          yearly: String(settings.rings.yearly),
          price:
            settings.pairUsdCents !== undefined ? (settings.pairUsdCents / 100).toFixed(2) : "",
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
        price: copy.price,
      },
    },
  };
}

export type RingSettingsCardVM = ReturnType<typeof useRingSettingsPresenter>["card"];
