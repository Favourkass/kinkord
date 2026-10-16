"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { adminUsername, toAdminTeamRowVM, type AdminTeamPM } from "@/domain/moderation";
import { moderationService } from "@/services/moderation.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";
import type { AdminDialogVM } from "./useAdminMemberPresenter";

type Pending = { kind: "add"; username: string } | { kind: "remove"; id: string; name: string };

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** Who has the admin tools. Every admin sees the list; the founders add and remove. */
export function useAdminTeamPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.admins;
  const [team, setTeam] = useState<AdminTeamPM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    moderationService.team().then(
      (t) => live && setTeam(t),
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin]);

  const open = useCallback((next: Pending) => {
    setNotice(null);
    setDialogError(null);
    setPending(next);
  }, []);

  const submit = useCallback(() => {
    const handle = adminUsername(username);
    if (!handle) {
      setFormError(copy.enterUsername);
      return;
    }
    setFormError(null);
    open({ kind: "add", username: handle });
  }, [username, copy.enterUsername, open]);

  const cancel = useCallback(() => {
    if (!busy) setPending(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!pending || busy) return;
    setBusy(true);
    setDialogError(null);
    try {
      if (pending.kind === "add") {
        const added = await moderationService.addAdmin(pending.username);
        setTeam(
          (t) => t && { ...t, admins: [...t.admins.filter((a) => a.id !== added.id), added] },
        );
        setUsername("");
        setNotice(copy.added(added.username ?? pending.username));
      } else {
        await moderationService.removeAdmin(pending.id);
        setTeam((t) => t && { ...t, admins: t.admins.filter((a) => a.id !== pending.id) });
        setNotice(copy.removed(pending.name));
      }
      setPending(null);
    } catch (e) {
      setDialogError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [pending, busy, copy]);

  const canManage = team?.canManage ?? false;
  const rows = useMemo(
    () =>
      (team?.admins ?? []).map((a) =>
        toAdminTeamRowVM(a, {
          canManage,
          href: Routes.moderationMember,
          labels: { founder: copy.founder, since: copy.since },
        }),
      ),
    [team, canManage, copy],
  );

  const dialog = useMemo((): AdminDialogVM | null => {
    if (!pending) return null;
    const adding = pending.kind === "add";
    return {
      title: adding
        ? copy.addDialog.title(pending.username)
        : copy.removeDialog.title(pending.name),
      body: adding ? copy.addDialog.body : copy.removeDialog.body,
      confirmLabel: adding ? copy.addDialog.confirm : copy.removeDialog.confirm,
      cancelLabel: MODERATION_COPY.dialogs.cancel,
      destructive: !adding,
      reason: null,
      checkbox: null,
      typeToConfirm: null,
      canConfirm: !busy,
      busy,
      error: dialogError,
      confirm: () => void confirm(),
      cancel,
    };
  }, [pending, busy, dialogError, copy, confirm, cancel]);

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    loading: access.isAdmin && team === null && !error,
    error,
    rows,
    canManage,
    notice,
    dialog,
    remove: (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (row?.removable) open({ kind: "remove", id, name: row.title });
    },
    form: {
      username,
      setUsername: (v: string) => {
        setUsername(v);
        setFormError(null);
      },
      error: formError,
      submit,
    },
    labels: {
      intro: copy.intro,
      locked: copy.locked,
      username: copy.usernameLabel,
      placeholder: copy.usernamePlaceholder,
      add: copy.add,
      remove: copy.remove,
      loading: copy.loading,
    },
  };
}
