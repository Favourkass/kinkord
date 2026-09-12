"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_EDIT_COPY, ROW_ICONS } from "@/constants/profileEdit";
import { Routes } from "@/constants/Routes";
import type {
  EditorDraft,
  EditorSpec,
  EditRowKey,
  EditRowPM,
  EditSectionKey,
  MePM,
  OwnProfilePM,
  ProfileOptionsPM,
  ProfileVisibility,
} from "@/domain/profile";
import { ApiError } from "@/services/apiClient";
import {
  buildEditRows,
  draftChanged,
  fieldErrorMessage,
  initialDraft,
  patchFor,
  profileApi,
  usernameFromDraft,
  validateDraft,
} from "@/services/profile.service";
import { shortDate } from "@/util/format";

interface EditorState {
  key: EditRowKey;
  draft: EditorDraft;
  error: string | null;
  saving: boolean;
}

const visibilityCopy = (value: string) =>
  PROFILE_EDIT_COPY.visibility[value as ProfileVisibility] ?? { label: value, help: "" };

/** Editor sheet props for one row's spec, with copy applied. */
function toEditorVM(key: EditRowKey, spec: EditorSpec) {
  const copy = PROFILE_EDIT_COPY;
  const placeholder = (copy.placeholders as Partial<Record<EditRowKey, string>>)[key] ?? "";
  switch (spec.kind) {
    case "text":
      return {
        kind: "text" as const,
        maxLength: spec.maxLength,
        placeholder,
        prefix: key === "username" ? "@" : undefined,
      };
    case "textarea":
      return { kind: "textarea" as const, maxLength: spec.maxLength, placeholder };
    case "single":
      return {
        kind: "single" as const,
        searchable: spec.searchable,
        options:
          key === "profileVisibility"
            ? spec.options.map((o) => ({ value: o.value, ...visibilityCopy(o.value) }))
            : spec.options,
      };
    case "multi":
      return {
        kind: "multi" as const,
        options: spec.options,
        max: spec.max,
        searchable: spec.searchable,
      };
    case "date":
      return { kind: "date" as const, max: spec.max };
    case "links":
      return {
        kind: "links" as const,
        fields: (["facebook", "x"] as const).map((k) => ({
          key: k,
          label: copy.links[k].label,
          placeholder: copy.links[k].placeholder,
        })),
      };
  }
}

/**
 * One Edit Profile section (Basic / Kinks / Location / Privacy): rows come from the
 * API payloads, each opens an editor sheet, saving PATCHes only that field. Username
 * goes through its own endpoint (30-day lock, like display name).
 */
export function useEditSectionPresenter(section: EditSectionKey) {
  const router = useRouter();
  const copy = PROFILE_EDIT_COPY;
  const [me, setMe] = useState<MePM | null>(null);
  const [profile, setProfile] = useState<OwnProfilePM | null>(null);
  const [options, setOptions] = useState<ProfileOptionsPM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [m, p, o] = await Promise.all([
          profileApi.me(),
          profileApi.own(),
          profileApi.options(),
        ]);
        if (cancelled) return;
        setMe(m);
        setProfile(p);
        setOptions(o);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        setError(copy.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, copy.loadError]);

  const rows = useMemo<EditRowPM[]>(
    () => (me && profile && options ? buildEditRows(section, { profile, me, options }) : []),
    [section, me, profile, options],
  );
  const current = editor ? (rows.find((r) => r.key === editor.key) ?? null) : null;

  const openRow = useCallback(
    (key: EditRowKey) => {
      const row = rows.find((r) => r.key === key);
      if (!row) return;
      setNotice(null);
      setEditor({ key, draft: initialDraft(row.editor), error: null, saving: false });
    },
    [rows],
  );

  const setDraft = useCallback((draft: EditorDraft) => {
    setEditor((st) => (st ? { ...st, draft, error: null } : st));
  }, []);

  const cancel = useCallback(() => setEditor(null), []);

  const save = useCallback(async () => {
    if (!editor || !current || !profile) return;
    const issue = validateDraft(current.editor, editor.draft);
    if (issue) {
      setEditor({ ...editor, error: copy.issues[issue] });
      return;
    }
    setEditor({ ...editor, saving: true, error: null });
    try {
      if (editor.key === "username") {
        const res = await profileApi.changeUsername(usernameFromDraft(editor.draft));
        setMe((m) =>
          m ? { ...m, username: res.username, displayUsername: res.displayUsername } : m,
        );
        setProfile((p) =>
          p
            ? {
                ...p,
                usernameChangedAt: res.usernameChangedAt,
                canChangeUsernameAt: res.canChangeUsernameAt,
              }
            : p,
        );
      } else {
        setProfile(await profileApi.update(patchFor(editor.key, editor.draft, profile)));
      }
      setEditor(null);
      setNotice(copy.saved);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(Routes.login);
        return;
      }
      const message = e instanceof ApiError ? fieldErrorMessage(e.body) : null;
      setEditor((st) => (st ? { ...st, saving: false, error: message ?? copy.saveError } : st));
    }
  }, [editor, current, profile, copy, router]);

  const rowItems = rows.map((r) => ({
    key: r.key,
    icon: ROW_ICONS[r.key],
    title: copy.rows[r.key].title,
    subtitle:
      r.key === "profileVisibility"
        ? visibilityCopy(r.value ?? "public").label
        : (r.value ?? (r.key === "socialLinks" ? copy.notLinked : copy.empty)),
    onClick: () => openRow(r.key),
  }));

  let editorVM = null;
  if (editor && current) {
    const spec = current.editor;
    const lockDate = spec.kind === "text" ? spec.lockedUntil : null;
    const lockMessage = lockDate ? copy.lockedUntil(shortDate(lockDate) ?? lockDate) : null;
    editorVM = {
      title: copy.rows[editor.key].title,
      help: copy.rows[editor.key].help,
      lockMessage,
      editor: toEditorVM(editor.key, spec),
      draft: editor.draft,
      onDraft: setDraft,
      error: editor.error,
      saving: editor.saving,
      canSave: lockMessage === null && draftChanged(spec, editor.draft),
      labels: {
        save: copy.save,
        cancel: copy.cancel,
        saving: copy.saving,
        close: copy.close,
        search: copy.search,
        selected:
          spec.kind === "multi" && editor.draft.kind === "multi"
            ? copy.selected(editor.draft.value.length, spec.max)
            : null,
      },
      onSave: () => {
        void save();
      },
      onCancel: cancel,
    };
  }

  return {
    loading,
    error,
    notice,
    title: copy.title,
    backLabel: copy.back,
    loadingLabel: copy.loading,
    heading: copy.sections[section].heading,
    subtitle: copy.sections[section].subtitle,
    variant: (section === "privacy" ? "cards" : "list") as "cards" | "list",
    rows: rowItems,
    editor: editorVM,
    openRow,
    back: () => router.push(Routes.profileEdit),
  };
}
