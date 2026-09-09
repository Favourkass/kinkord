"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import type { StateRowVM } from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import {
  filterStates,
  isCountryAvailable,
  membersApi,
  mergeStateCounts,
  statesForCountry,
  type StateCountPM,
} from "@/services/members.service";
import { compactNumber, countryName } from "@/util/format";

/** Members → {Country}: pick a state (radio rows) then Continue — Figma 886:1076. */
export function useMembersStatePresenter(countryParam: string) {
  const router = useRouter();
  const copy = MEMBERS_COPY.state;
  const country = countryParam.toUpperCase();
  const available = isCountryAvailable(country);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [counts, setCounts] = useState<StateCountPM[]>([]);
  const [loading, setLoading] = useState(available);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    void membersApi
      .states(country)
      .then((rows) => {
        if (!cancelled) setCounts(rows);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setError(MEMBERS_COPY.common.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [available, country, router]);

  const rows = useMemo<StateRowVM[]>(
    () =>
      filterStates(mergeStateCounts(statesForCountry(country), counts), query).map((r) => ({
        state: r.state,
        count: compactNumber(r.membersCount),
        selected: r.state === selected,
      })),
    [country, counts, query, selected],
  );

  const onContinue = useCallback(() => {
    if (selected) router.push(Routes.membersState(country, selected));
  }, [router, country, selected]);

  return {
    title: countryName(country) ?? country,
    subtitle: copy.subtitle,
    available,
    notAvailable: available ? null : copy.notAvailable,
    search: {
      value: query,
      onChange: setQuery,
      placeholder: copy.searchPlaceholder,
      label: copy.searchLabel,
    },
    rows,
    membersSuffix: copy.membersSuffix,
    selected,
    onSelect: setSelected,
    selectLabel: copy.selectLabel,
    continueLabel: copy.continueLabel,
    canContinue: selected !== null,
    onContinue,
    noResults: query.trim() && rows.length === 0 ? copy.noResults : null,
    loading,
    error,
  };
}
