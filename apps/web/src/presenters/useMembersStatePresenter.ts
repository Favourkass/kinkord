"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import { ApiError } from "@/services/apiClient";
import {
  filterStates,
  isCountryAvailable,
  membersApi,
  mergeStateCounts,
  statesForCountry,
  type StateCountPM,
} from "@/services/members.service";
import { compactNumber, countryName, flagEmoji } from "@/util/format";

export interface StateRowVM {
  state: string;
  subtitle: string;
  href: string;
}

/** Members → {Country} → choose a state. Every configured state shows with its live count. */
export function useMembersStatePresenter(countryParam: string) {
  const router = useRouter();
  const copy = MEMBERS_COPY.state;
  const country = countryParam.toUpperCase();
  const available = isCountryAvailable(country);
  const [query, setQuery] = useState("");
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
        subtitle: `${compactNumber(r.membersCount)} ${copy.membersSuffix}`,
        href: Routes.membersState(country, r.state),
      })),
    [country, counts, query, copy.membersSuffix],
  );

  return {
    header: {
      ...MEMBERS_COPY.header,
      backHref: Routes.members,
      backLabel: MEMBERS_COPY.header.back,
    },
    title: countryName(country) ?? country,
    flag: flagEmoji(country),
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
    noResults: query.trim() && rows.length === 0 ? copy.noResults : null,
    loading,
    error,
  };
}
