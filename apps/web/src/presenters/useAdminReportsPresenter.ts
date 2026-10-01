"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { toAdminReportVM, type AdminReportPM, type AdminReportStatus } from "@/domain/moderation";
import { moderationService } from "@/services/moderation.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

const STATUSES: AdminReportStatus[] = ["open", "resolved", "dismissed"];

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** The moderators' report queue: open reports, most serious first, and the closed ones. */
export function useAdminReportsPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.reports;
  const [status, setStatus] = useState<AdminReportStatus>("open");
  // Kept with the status it was loaded for, so switching never shows the wrong list.
  const [loaded, setLoaded] = useState<{ status: AdminReportStatus; rows: AdminReportPM[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    moderationService.reports(status).then(
      (rows) => {
        if (!live) return;
        setLoaded({ status, rows });
        setError(null);
      },
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, status]);

  const close = useCallback(async (id: string, next: "resolved" | "dismissed") => {
    setBusy(id);
    setError(null);
    try {
      await moderationService.resolveReport(id, next);
      setLoaded((l) => l && { ...l, rows: l.rows.filter((r) => r.id !== id) });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const current = loaded?.status === status ? loaded.rows : null;
  const rows = useMemo(
    () =>
      (current ?? []).map((pm) =>
        toAdminReportVM(pm, Routes.moderationMember, { deletedAccount: copy.deletedAccount }),
      ),
    [current, copy.deletedAccount],
  );

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    statuses: STATUSES.map((value) => ({
      value,
      label: copy.statuses[value],
      active: value === status,
    })),
    setStatus,
    loading: access.isAdmin && current === null && error === null,
    error,
    empty: current !== null && current.length === 0,
    rows,
    busy,
    resolve: (id: string) => void close(id, "resolved"),
    dismiss: (id: string) => void close(id, "dismissed"),
    labels: {
      loading: copy.loading,
      empty: copy.empty,
      reportedBy: copy.reportedBy,
      details: copy.details,
      evidence: copy.evidence,
      noEvidence: copy.noEvidence,
      openMember: copy.openMember,
      resolve: copy.resolve,
      dismiss: copy.dismiss,
      photo: copy.photo,
    },
  };
}
