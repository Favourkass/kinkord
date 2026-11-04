"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { adminUsername } from "@/domain/moderation";
import { teamTitle, toTeamPageAdminRowVM, type TeamPageAdminPM } from "@/domain/team";
import { teamPageAdminApi } from "@/services/team.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";
import type { AdminDialogVM } from "./useAdminMemberPresenter";

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/**
 * Meet the Team from the admin side: the founders pick members and say what
 * each does at Kinkord ("Software Engineer"). Every admin sees who is on it.
 */
export function useTeamPageAdminPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.teamPage;
  const [team, setTeam] = useState<TeamPageAdminPM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    teamPageAdminApi.list().then(
      (t) => live && setTeam(t),
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, reloads]);

  const clearForm = useCallback(() => {
    setUsername("");
    setTitle("");
    setEditing(false);
    setFormError(null);
  }, []);

  const submit = useCallback(async () => {
    const handle = adminUsername(username);
    const role = teamTitle(title);
    if (!handle) return setFormError(copy.enterUsername);
    if (!role) return setFormError(copy.enterTitle);
    if (saving) return;
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const saved = await teamPageAdminApi.setTitle(handle, role);
      const had = team?.members.some((m) => m.id === saved.id && m.title) ?? false;
      const who = saved.username ?? handle;
      setNotice(had ? copy.changed(who, role) : copy.added(who, role));
      clearForm();
      // The page's order is the server's: first given a role, first shown.
      setReloads((n) => n + 1);
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setSaving(false);
    }
  }, [clearForm, copy, saving, team, title, username]);

  const canManage = team?.canManage ?? false;
  const rows = useMemo(
    () =>
      (team?.members ?? []).map((m) =>
        toTeamPageAdminRowVM(
          m,
          { noTitle: copy.noTitle, blocked: copy.blocked },
          Routes.moderationMember,
        ),
      ),
    [team, copy],
  );

  const cancelRemove = useCallback(() => {
    if (!busy) setRemoving(null);
  }, [busy]);

  const confirmRemove = useCallback(async () => {
    if (!removing || busy) return;
    setBusy(true);
    setDialogError(null);
    try {
      await teamPageAdminApi.remove(removing.id);
      setNotice(copy.removed(removing.name));
      setRemoving(null);
      setReloads((n) => n + 1);
    } catch (e) {
      setDialogError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [busy, copy, removing]);

  const dialog = useMemo((): AdminDialogVM | null => {
    if (!removing) return null;
    return {
      title: copy.removeDialog.title(removing.name),
      body: copy.removeDialog.body,
      confirmLabel: copy.removeDialog.confirm,
      cancelLabel: MODERATION_COPY.dialogs.cancel,
      destructive: true,
      reason: null,
      checkbox: null,
      typeToConfirm: null,
      canConfirm: !busy,
      busy,
      error: dialogError,
      confirm: () => void confirmRemove(),
      cancel: cancelRemove,
    };
  }, [busy, cancelRemove, confirmRemove, copy, dialogError, removing]);

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    loading: access.isAdmin && team === null && !error,
    error,
    empty: team && team.members.length === 0 ? copy.empty : null,
    rows,
    canManage,
    notice,
    dialog,
    pageHref: Routes.team,
    /** Puts their handle and current role in the form, to change the role. */
    edit: (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row?.username) return;
      setUsername(`@${row.username}`);
      setTitle(row.currentTitle);
      setEditing(true);
      setFormError(null);
      setNotice(null);
    },
    remove: (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      setNotice(null);
      setDialogError(null);
      setRemoving({ id, name: row.name });
    },
    form: {
      username,
      setUsername: (v: string) => {
        setUsername(v);
        setFormError(null);
      },
      title,
      setTitle: (v: string) => {
        setTitle(v);
        setFormError(null);
      },
      editing,
      saving,
      error: formError,
      submit: () => void submit(),
      cancel: clearForm,
    },
    labels: {
      intro: copy.intro,
      publicNote: copy.publicNote,
      locked: copy.locked,
      username: copy.usernameLabel,
      usernamePlaceholder: copy.usernamePlaceholder,
      title: copy.titleLabel,
      titlePlaceholder: copy.titlePlaceholder,
      add: copy.add,
      save: copy.save,
      cancelEdit: copy.cancelEdit,
      change: copy.change,
      remove: copy.remove,
      viewPage: copy.viewPage,
      loading: copy.loading,
    },
  };
}

export type TeamPageAdminVM = ReturnType<typeof useTeamPageAdminPresenter>;
