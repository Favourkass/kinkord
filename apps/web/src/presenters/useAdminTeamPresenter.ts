"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { adminUsername, toAdminTeamRowVM, type AdminTeamPM } from "@/domain/moderation";
import { moderationService } from "@/services/moderation.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";
import type { AdminDialogVM } from "./useAdminMemberPresenter";

type Pending =
  | { kind: "add"; username: string }
  | { kind: "remove" | "give-silver" | "remove-silver"; id: string; name: string };

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/**
 * Who has the admin tools. Every admin sees the list; the founders add and
 * remove admins, and give them Silver or take it back.
 */
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
      } else if (pending.kind === "remove") {
        await moderationService.removeAdmin(pending.id);
        setTeam((t) => t && { ...t, admins: t.admins.filter((a) => a.id !== pending.id) });
        setNotice(copy.removed(pending.name));
      } else {
        const giving = pending.kind === "give-silver";
        const updated = await moderationService.setAdminSilver(pending.id, giving);
        setTeam(
          (t) => t && { ...t, admins: t.admins.map((a) => (a.id === updated.id ? updated : a)) },
        );
        setNotice(
          giving ? copy.silverGivenNotice(pending.name) : copy.silverRemovedNotice(pending.name),
        );
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
          labels: {
            founder: copy.founder,
            since: copy.since,
            silverGiven: copy.silverGiven,
            silverPaid: copy.silverPaid,
          },
        }),
      ),
    [team, canManage, copy],
  );

  const dialog = useMemo((): AdminDialogVM | null => {
    if (!pending) return null;
    const dialogs = {
      remove: copy.removeDialog,
      "give-silver": copy.giveSilverDialog,
      "remove-silver": copy.removeSilverDialog,
    };
    const text =
      pending.kind === "add"
        ? { ...copy.addDialog, title: copy.addDialog.title(pending.username) }
        : { ...dialogs[pending.kind], title: dialogs[pending.kind].title(pending.name) };
    return {
      title: text.title,
      body: text.body,
      confirmLabel: text.confirm,
      cancelLabel: MODERATION_COPY.dialogs.cancel,
      destructive: pending.kind === "remove" || pending.kind === "remove-silver",
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
    silver: (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row?.silverAction) return;
      open({
        kind: row.silverAction === "give" ? "give-silver" : "remove-silver",
        id,
        name: row.title,
      });
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
      giveSilver: copy.giveSilver,
      removeSilver: copy.removeSilver,
      loading: copy.loading,
    },
  };
}
