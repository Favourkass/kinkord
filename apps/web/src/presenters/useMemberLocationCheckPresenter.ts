"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MEMBER_LOCATION_COPY } from "@/constants/locationCheck";
import { LAUNCH_COUNTRIES } from "@/constants/onboarding";
import { Routes } from "@/constants/Routes";
import { safeNext } from "@/domain/locationCheck";
import { ApiError } from "@/services/apiClient";
import { profileApi } from "@/services/profile.service";
import { signupCountryOptions, signupLocationFields } from "@/services/signupLocation.service";
import { useLocationCheckPresenter } from "./useLocationCheckPresenter";

const served = (code: string | null | undefined): string | null =>
  code && LAUNCH_COUNTRIES.some((c) => c.code === code) ? code : null;
const nameOf = (code: string | null): string | null =>
  LAUNCH_COUNTRIES.find((c) => c.code === code)?.name ?? code;

/**
 * /location-check, where the app sends a member whose country check is due
 * (the API's LOCATION_CHECK_REQUIRED hold): confirm the country on their
 * profile or, on a mismatch, choose the one they're in, check it, and save
 * it. `?change=1&country=GH` opens straight on choosing (Edit Profile, when a
 * country switch needs confirming); `?next=` is where they return after.
 */
export function useMemberLocationCheckPresenter() {
  const router = useRouter();
  const params = useSearchParams();
  const copy = MEMBER_LOCATION_COPY;
  const next = safeNext(params.get("next"), Routes.appHome);
  // undefined while loading; null for a profile without a country.
  const [profileCountry, setProfileCountry] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(params.get("change") === "1");
  const [country, setCountry] = useState<string | null>(served(params.get("country")));
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    profileApi.own().then(
      (profile) => {
        if (!live) return;
        setProfileCountry(profile.country ?? null);
        if (!profile.country) setChoosing(true);
      },
      (e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) router.replace(Routes.login);
        else setLoadError(copy.loadError);
      },
    );
    return () => {
      live = false;
    };
  }, [router, copy.loadError]);

  const target = choosing ? country : (profileCountry ?? null);
  const ready = choosing ? Boolean(country && state) : Boolean(profileCountry);

  const passed = useCallback(async () => {
    if (!choosing) {
      router.replace(next);
      return;
    }
    // The server spends the check on this switch; the state belongs to the new country.
    setSaving(true);
    setSaveError(null);
    try {
      await profileApi.update({ country, state, city: null });
      router.replace(next);
    } catch {
      setSaveError(copy.saveError);
    } finally {
      setSaving(false);
    }
  }, [choosing, country, state, router, next, copy.saveError]);

  const check = useLocationCheckPresenter({
    country: ready ? target : null,
    countryName: nameOf(target),
    active: profileCountry !== undefined,
    onPassed: () => void passed(),
    onChangeCountry: (detected) => {
      setChoosing(true);
      setCountry(served(detected));
      setState("");
    },
  });

  const choose = useMemo(() => {
    if (!choosing) return null;
    const fields = signupLocationFields(country, state);
    return {
      title: copy.chooseTitle,
      body: copy.chooseBody,
      country: {
        label: copy.countryLabel,
        placeholder: copy.countryPlaceholder,
        searchPlaceholder: copy.countrySearch,
        emptyLabel: copy.noCountries,
        value: country ?? "",
        options: signupCountryOptions(),
        onChange: (value: string) => {
          setCountry(value);
          setState("");
        },
      },
      state: {
        label: fields.stateLabel,
        placeholder: fields.statePlaceholder,
        searchPlaceholder: fields.stateSearchPlaceholder,
        emptyLabel: fields.areaEmptyLabel,
        value: state,
        options: fields.states,
        onChange: setState,
        disabled: !country,
      },
      hint: country && !state ? copy.stateRequired : null,
    };
  }, [choosing, country, state, copy]);

  return {
    loading: profileCountry === undefined && !loadError,
    loadingLabel: copy.loading,
    loadError,
    saving,
    saveError,
    panel: check.panel,
    choose,
  };
}
