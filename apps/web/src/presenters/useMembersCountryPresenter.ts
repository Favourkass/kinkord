"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import type { CountryRowVM } from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import { membersApi, searchCountries, type CountryCountPM } from "@/services/members.service";
import { compactNumber, flagEmoji } from "@/util/format";

/** Members → "Select a Country": launched countries with live totals; search reveals the rest. */
export function useMembersCountryPresenter() {
  const router = useRouter();
  const copy = MEMBERS_COPY.country;
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<CountryCountPM[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void membersApi
      .countries()
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
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const rows = useMemo<CountryRowVM[]>(
    () =>
      searchCountries(query, counts).map((o) => ({
        code: o.code,
        name: o.name,
        flag: o.flag,
        emoji: flagEmoji(o.code),
        membersLabel:
          o.available && o.membersCount !== null
            ? `${compactNumber(o.membersCount)} ${copy.membersSuffix}`
            : null,
        comingSoon: !o.available,
        href: o.available ? Routes.membersCountry(o.code) : null,
      })),
    [query, counts, copy.membersSuffix],
  );

  const searching = query.trim().length > 0;

  return {
    title: copy.title,
    subtitle: copy.subtitle,
    search: {
      value: query,
      onChange: setQuery,
      placeholder: copy.searchPlaceholder,
      label: copy.searchLabel,
    },
    heading: searching ? copy.resultsHeading : copy.availableHeading,
    rows,
    noResults: searching && rows.length === 0 ? copy.noResults : null,
    error,
    banner: copy.banner,
    comingSoonLabel: copy.comingSoon,
  };
}
