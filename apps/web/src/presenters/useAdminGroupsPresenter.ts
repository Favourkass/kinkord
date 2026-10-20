"use client";

import { useEffect, useState } from "react";
import { GROUP_CATEGORY_LABELS, GROUPS_COPY } from "@/constants/groups";
import { Routes } from "@/constants/Routes";
import { ApiError } from "@/services/apiClient";
import { groupsService, type AdminGroupPM } from "@/services/groups.service";
import { shortDate } from "@/util/format";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";
import type { AdminDialogVM } from "./useAdminMemberPresenter";

type Status = "all" | "live" | "archived";
const copy = GROUPS_COPY.admin;

/** Admin → Groups: every group, closing one down or restoring it. */
export function useAdminGroupsPresenter() {
  const access = useAdminAccessPresenter();
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminGroupPM[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const key = `${status}:${page}:${version}`;
  const [pending, setPending] = useState<AdminGroupPM | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    groupsService.adminList(status, page).then(
      (res) => {
        if (!live) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        setError(null);
        setLoaded(key);
      },
      (e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : GROUPS_COPY.error);
        setLoaded(key);
      },
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, status, page, key]);
  const loading = loaded !== key;

  const archived = Boolean(pending?.archivedAt);
  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await groupsService.adminArchive(pending.id, !archived);
      setPending(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : GROUPS_COPY.group.error);
    } finally {
      setBusy(false);
    }
  };

  const dialog: AdminDialogVM | null = pending
    ? {
        title: pending.name,
        body: archived ? copy.restoreConfirm : copy.archiveConfirm,
        confirmLabel: archived ? copy.restore : copy.archive,
        cancelLabel: GROUPS_COPY.composer.cancel,
        destructive: !archived,
        reason: null,
        checkbox: null,
        typeToConfirm: null,
        canConfirm: !busy,
        busy,
        error: actionError,
        confirm: () => void confirm(),
        cancel: () => {
          if (!busy) setPending(null);
        },
      }
    : null;

  return {
    ...access,
    title: copy.title,
    intro: copy.intro,
    status,
    statuses: (Object.keys(copy.status) as Status[]).map((key) => ({
      value: key,
      label: copy.status[key],
    })),
    setStatus: (next: Status) => {
      setStatus(next);
      setPage(1);
    },
    loading: access.isAdmin && loading,
    error,
    empty: !loading && !error && items.length === 0 ? copy.empty : null,
    rows: items.map((g) => ({
      id: g.id,
      name: g.name,
      href: g.archivedAt ? null : Routes.group(g.slug),
      meta: [
        GROUP_CATEGORY_LABELS[g.category],
        GROUPS_COPY.privacy[g.privacy],
        GROUPS_COPY.members(g.members),
        shortDate(g.createdAt),
      ]
        .filter(Boolean)
        .join(" · "),
      owner: g.ownerUsername ? `${copy.owner}: @${g.ownerUsername}` : null,
      archived: Boolean(g.archivedAt),
      archivedLabel: g.archivedAt ? copy.status.archived : null,
      action: {
        label: g.archivedAt ? copy.restore : copy.archive,
        onClick: () => {
          setActionError(null);
          setPending(g);
        },
      },
    })),
    previous: page > 1 ? () => setPage((p) => p - 1) : null,
    next: hasMore ? () => setPage((p) => p + 1) : null,
    retry: () => setVersion((v) => v + 1),
    dialog,
  };
}
