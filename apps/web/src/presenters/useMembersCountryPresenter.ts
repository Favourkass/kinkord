"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";
import { ApiError } from "@/services/apiClient";
import { membersApi, searchCountries, type CountryCountPM } from "@/services/members.service";
import { compactNumber, flagEmoji } from "@/util/format";

export interface CountryRowVM {
  code: string;
  name: string;
  /** Local flag asset for launched countries, else null (use `emoji`). */
  flag: string | null;
  emoji: string;
  /** "12.4K Members" for launched countries, "Coming Soon" otherwise. */
  subtitle: string;
  href: string | null;
  badge: string | null;
}

/** Members → Select a Country: launched countries with live totals; search reveals the rest. */
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
        subtitle: o.available
          ? o.membersCount === null
            ? "…"
            : `${compactNumber(o.membersCount)} ${copy.membersSuffix}`
          : copy.comingSoon,
        href: o.available ? Routes.membersCountry(o.code) : null,
        badge: o.available ? null : copy.comingSoon,
      })),
    [query, counts, copy.membersSuffix, copy.comingSoon],
  );

  const searching = query.trim().length > 0;

  return {
    header: {
      ...MEMBERS_COPY.header,
      backHref: Routes.appHome,
      backLabel: MEMBERS_COPY.header.back,
    },
    title: copy.title,
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
  };
}
