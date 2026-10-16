"use client";

import { useCallback, useEffect, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import {
  naira,
  nairaDigits,
  parseNaira,
  usd,
  type PaymentSettingsInputPM,
  type PaymentSettingsPM,
} from "@/domain/subscription";
import { paymentsAdminService } from "@/services/subscription.service";

interface SettingsForm {
  bankName: string;
  accountName: string;
  accountNumber: string;
  monthlyNaira: string;
  yearlyNaira: string;
  monthlyUsd: string;
  yearlyUsd: string;
}

const EMPTY: SettingsForm = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  monthlyNaira: "",
  yearlyNaira: "",
  monthlyUsd: "",
  yearlyUsd: "",
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

const cents = (dollars: string): number | null => {
  const clean = dollars.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const value = Math.round(Number(clean) * 100);
  return value > 0 ? value : null;
};

/** The form as an API body, or null when something in it isn't valid. */
export function settingsInput(form: SettingsForm): PaymentSettingsInputPM | null {
  const monthlyKobo = parseNaira(form.monthlyNaira);
  const yearlyKobo = parseNaira(form.yearlyNaira);
  const monthlyUsdCents = cents(form.monthlyUsd);
  const yearlyUsdCents = cents(form.yearlyUsd);
  if (
    form.bankName.trim().length < 2 ||
    form.accountName.trim().length < 2 ||
    !/^\d{10}$/.test(form.accountNumber.trim()) ||
    !monthlyKobo ||
    !yearlyKobo ||
    !monthlyUsdCents ||
    !yearlyUsdCents
  ) {
    return null;
  }
  return {
    bankName: form.bankName.trim(),
    accountName: form.accountName.trim(),
    accountNumber: form.accountNumber.trim(),
    monthlyKobo,
    yearlyKobo,
    monthlyUsdCents,
    yearlyUsdCents,
  };
}

function formFrom(s: PaymentSettingsPM): SettingsForm {
  return {
    bankName: s.bank?.name ?? "",
    accountName: s.bank?.accountName ?? "",
    accountNumber: s.bank?.accountNumber ?? "",
    monthlyNaira: nairaDigits(s.prices.monthly.kobo),
    yearlyNaira: nairaDigits(s.prices.yearly.kobo),
    monthlyUsd: String(s.prices.monthly.usdCents / 100),
    yearlyUsd: String(s.prices.yearly.usdCents / 100),
  };
}

/** Where members are told to pay, and the prices; the founders alone can change them. */
export function usePaymentSettingsPresenter(enabled: boolean) {
  const copy = MODERATION_COPY.paymentSettings;
  const [settings, setSettings] = useState<PaymentSettingsPM | null>(null);
  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    paymentsAdminService.settings().then(
      (s) => live && setSettings(s),
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [enabled]);

  const save = useCallback(async () => {
    const input = settingsInput(form);
    if (!input) {
      setError(copy.invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setSettings(await paymentsAdminService.saveSettings(input));
      setEditing(false);
      setNotice(copy.saved);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSaving(false);
    }
  }, [copy, form]);

  return {
    loading: enabled && settings === null && error === null,
    canEdit: settings?.canEdit ?? false,
    bank: settings?.bank ?? null,
    prices: settings
      ? {
          monthly: `${naira(settings.prices.monthly.kobo)} · ${usd(settings.prices.monthly.usdCents)}`,
          yearly: `${naira(settings.prices.yearly.kobo)} · ${usd(settings.prices.yearly.usdCents)}`,
        }
      : null,
    editing,
    edit: () => {
      if (!settings) return;
      setForm(formFrom(settings));
      setEditing(true);
      setNotice(null);
      setError(null);
    },
    cancel: () => {
      setEditing(false);
      setError(null);
    },
    form,
    setField: (field: keyof SettingsForm, value: string) =>
      setForm((f) => ({ ...f, [field]: value })),
    saving,
    save: () => void save(),
    error,
    notice,
    labels: copy,
  };
}
