"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LOCATION_ADMIN_COPY } from "@/constants/locationCheck";
import { LAUNCH_COUNTRIES } from "@/constants/onboarding";
import {
  accuracyLabel,
  countByDecision,
  isPassing,
  type LocationCheckDecision,
  type LocationCheckMode,
  type LocationCheckRowPM,
  type LocationCheckSummaryPM,
} from "@/domain/locationCheck";
import { locationCheckService } from "@/services/locationCheck.service";
import { countryName as regionName } from "@/util/format";
import type { AdminDialogVM } from "./useAdminMemberPresenter";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

const WINDOW_DAYS = 7;
const PAGE_SIZE = 50;
const MODES: LocationCheckMode[] = ["off", "watch", "enforce"];
const DECISIONS: LocationCheckDecision[] = [
  "approved",
  "travel",
  "mismatch",
  "retry",
  "refused",
  "paused",
  "skipped",
];

/** Kinkord's own names for its countries ("USA"), everyone else's from util/format. */
const countryName = (code: string | null): string =>
  code ? (LAUNCH_COUNTRIES.find((c) => c.code === code)?.name ?? regionName(code) ?? code) : "—";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const when = (iso: string | null): string => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? timeFormat.format(date) : "—";
};

const messageOf = (e: unknown): string =>
  e instanceof Error ? e.message : LOCATION_ADMIN_COPY.loadError;

export interface LocationCheckRowVM {
  id: string;
  when: string;
  /** "@tega · Recheck", or just "Joining" for someone without an account yet. */
  title: string;
  chose: string;
  gps: string;
  connection: string;
  anonymizer: string | null;
  decision: string;
  stopped: boolean;
  watching: string | null;
  reasons: string[];
}

/** One check as moderators read it: countries by name, reasons in words, no coordinates. */
export function toLocationCheckRowVM(row: LocationCheckRowPM): LocationCheckRowVM {
  const copy = LOCATION_ADMIN_COPY;
  const accuracy = accuracyLabel(row.gpsAccuracyM);
  return {
    id: row.id,
    when: when(row.createdAt),
    title: row.username
      ? `@${row.username} · ${copy.purposes[row.purpose]}`
      : copy.purposes[row.purpose],
    chose: countryName(row.selectedCountry),
    gps:
      row.gpsStatus === "ok"
        ? [countryName(row.gpsCountry), accuracy].filter(Boolean).join(" · ")
        : (copy.reasons[`gps_${row.gpsStatus}`] ?? copy.reasons.skipped),
    connection: [countryName(row.ipCountry), row.ipNetwork].filter(Boolean).join(" · "),
    anonymizer: row.ipAnonymizer ? copy.anonymizers[row.ipAnonymizer] : null,
    decision: copy.decisions[row.decision],
    stopped: !isPassing(row.decision),
    watching: row.enforced ? null : copy.notEnforced,
    reasons: row.reasons.map((reason) => copy.reasons[reason] ?? reason),
  };
}

/** Moderation → Location: how the country check is going, and the founders' switch. */
export function useLocationChecksPresenter() {
  const access = useAdminAccessPresenter();
  const copy = LOCATION_ADMIN_COPY;
  const [summary, setSummary] = useState<LocationCheckSummaryPM | null>(null);
  const [decision, setDecision] = useState<LocationCheckDecision | null>(null);
  // The rows belong to the filter they were loaded for; a new filter shows "Loading…".
  const [page, setPage] = useState<{
    decision: LocationCheckDecision | null;
    rows: LocationCheckRowPM[];
    hasMore: boolean;
  } | null>(null);
  const loaded = page && page.decision === decision ? page : null;
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingMode, setPendingMode] = useState<LocationCheckMode | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    locationCheckService.summary(WINDOW_DAYS).then(
      (s) => live && setSummary(s),
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin]);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    locationCheckService.list({ decision, limit: PAGE_SIZE }).then(
      (rows) => live && setPage({ decision, rows, hasMore: rows.length >= PAGE_SIZE }),
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, decision]);

  const loadMore = useCallback(async () => {
    const last = loaded?.rows[loaded.rows.length - 1];
    if (!last || loadingMore) return;
    const filter = decision;
    setLoadingMore(true);
    try {
      const more = await locationCheckService.list({
        before: last.createdAt,
        decision: filter,
        limit: PAGE_SIZE,
      });
      // Dropped if the filter changed while this page was on its way.
      setPage((current) =>
        current && current.decision === filter
          ? {
              decision: filter,
              rows: [...current.rows, ...more],
              hasMore: more.length >= PAGE_SIZE,
            }
          : current,
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoadingMore(false);
    }
  }, [loaded, loadingMore, decision]);

  const confirmMode = useCallback(async () => {
    if (!pendingMode) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      const { mode } = await locationCheckService.setMode(pendingMode);
      setSummary((s) => (s ? { ...s, mode } : s));
      setPendingMode(null);
    } catch (e) {
      setSwitchError(messageOf(e));
    } finally {
      setSwitching(false);
    }
  }, [pendingMode]);

  // Rows are formatted when they arrive, not each time the switch or a button changes.
  const rowVMs = useMemo(() => (loaded?.rows ?? []).map(toLocationCheckRowVM), [loaded]);

  const dialog: AdminDialogVM | null = pendingMode
    ? {
        title: copy.switchTitle(copy.modes[pendingMode].label),
        body: `${copy.modes[pendingMode].body} ${copy.switchConfirm}`,
        confirmLabel: copy.confirm,
        cancelLabel: copy.cancel,
        destructive: pendingMode === "enforce",
        reason: null,
        checkbox: null,
        typeToConfirm: null,
        canConfirm: true,
        busy: switching,
        error: switchError,
        confirm: () => void confirmMode(),
        cancel: () => setPendingMode(null),
      }
    : null;

  const view = useMemo(() => {
    const mode = summary?.mode ?? null;
    const totals = summary ? countByDecision(summary.counts) : null;
    return {
      intro: copy.intro,
      mode: {
        title: copy.modeTitle,
        current: mode ? copy.modes[mode] : null,
        options: access.isFounder
          ? MODES.filter((m) => m !== mode).map((m) => ({
              mode: m,
              label: copy.switchTo(copy.modes[m].label),
              onSelect: () => {
                setSwitchError(null);
                setPendingMode(m);
              },
            }))
          : [],
        founderOnly: access.isFounder ? null : copy.founderOnly,
      },
      window: copy.window(WINDOW_DAYS),
      stats: summary
        ? [
            { label: copy.stats.checks, value: String(summary.checks), note: null },
            { label: copy.stats.people, value: String(summary.people), note: null },
            {
              label: mode === "enforce" ? copy.stats.stoppedEnforced : copy.stats.stopped,
              value: summary.people
                ? `${summary.peopleStopped} (${Math.round((summary.peopleStopped / summary.people) * 100)}%)`
                : "0",
              note: copy.stats.stoppedNote,
            },
          ]
        : [],
      decisionsTitle: copy.decisionsTitle,
      decisions: totals
        ? DECISIONS.filter((d) => totals[d] > 0).map((d) => ({
            label: copy.decisions[d],
            count: totals[d],
          }))
        : [],
      reasonsTitle: copy.reasonsTitle,
      reasons: (summary?.topReasons ?? []).map((r) => ({
        label: copy.reasons[r.reason] ?? r.reason,
        count: r.count,
      })),
      dataTitle: copy.dataTitle,
      data: summary
        ? [
            summary.data.countryDataBuiltAt
              ? copy.dataLines.country(when(summary.data.countryDataBuiltAt))
              : copy.dataLines.missing,
            summary.data.networkDataBuiltAt
              ? copy.dataLines.network(when(summary.data.networkDataBuiltAt))
              : copy.dataLines.networkMissing,
            summary.data.torUpdatedAt
              ? copy.dataLines.tor(summary.data.torExits, when(summary.data.torUpdatedAt))
              : copy.dataLines.torMissing,
          ]
        : [],
      list: {
        title: copy.recentTitle,
        columns: {
          when: copy.when,
          chose: copy.chose,
          gps: copy.gps,
          connection: copy.connection,
          decision: copy.decision,
        },
        filter: {
          value: decision ?? "",
          options: [
            { value: "", label: copy.allDecisions },
            ...DECISIONS.map((d) => ({ value: d, label: copy.decisions[d] })),
          ],
          onChange: (value: string) => setDecision(value ? (value as LocationCheckDecision) : null),
        },
        loading: !loaded && !error,
        loadingLabel: copy.loading,
        rows: rowVMs,
        empty: loaded && loaded.rows.length === 0 ? copy.empty : null,
        loadMore: loaded?.hasMore
          ? { label: copy.loadMore, busy: loadingMore, onClick: () => void loadMore() }
          : null,
      },
      error,
    };
  }, [copy, summary, decision, loaded, rowVMs, error, loadingMore, loadMore, access.isFounder]);

  return { checking: access.checking, isAdmin: access.isAdmin, view, dialog };
}

export type LocationChecksVM = ReturnType<typeof useLocationChecksPresenter>["view"];
