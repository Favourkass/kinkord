"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RELATIONSHIPS_COPY } from "@/constants/relationships";
import { Routes } from "@/constants/Routes";
import {
  relationshipChoices,
  toRelationshipRowVM,
  type RelationshipOptionsPM,
  type RelationshipPM,
  type RelationshipsPM,
} from "@/domain/relationship";
import {
  canRequestRelationship,
  relationshipHandle,
  relationshipsApi,
} from "@/services/relationships.service";

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : RELATIONSHIPS_COPY.error;
}

/**
 * The Relationships screen: your links, the requests waiting either way, and
 * the form to ask someone. `prefill` is a username from a profile's "Link a
 * relationship" (?with=), so the form opens ready for them.
 */
export function useRelationshipsPresenter(ready: boolean, prefill: string | null) {
  const copy = RELATIONSHIPS_COPY;
  const [options, setOptions] = useState<RelationshipOptionsPM | null>(null);
  const [list, setList] = useState<RelationshipsPM | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [username, setUsername] = useState(prefill ? `@${relationshipHandle(prefill)}` : "");
  const [type, setType] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ending, setEnding] = useState<RelationshipPM | null>(null);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    Promise.all([relationshipsApi.options(), relationshipsApi.list()]).then(
      ([o, l]) => {
        if (!live) return;
        setOptions(o);
        setList(l);
      },
      () => live && setLoadError(copy.error),
    );
    return () => {
      live = false;
    };
  }, [ready, copy.error]);

  /** Runs one change; the API answers with the whole list again. */
  const run = useCallback(
    async (key: string, change: () => Promise<RelationshipsPM>, done: string) => {
      if (busy) return false;
      setBusy(key);
      setNotice(null);
      setFormError(null);
      try {
        setList(await change());
        setNotice(done);
        return true;
      } catch (e) {
        setFormError(messageOf(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [busy],
  );

  const submit = useCallback(async () => {
    if (!canRequestRelationship(username, type)) {
      setFormError(copy.form.invalid);
      return;
    }
    const handle = relationshipHandle(username);
    const sent = await run(
      "form",
      () => relationshipsApi.request(handle, type),
      copy.form.sent(handle),
    );
    if (sent) {
      setUsername("");
      setType("");
    }
  }, [username, type, run, copy.form]);

  const choices = useMemo(
    () => (options ? relationshipChoices(options, copy.form) : { ds: [], romantic: [] }),
    [options, copy.form],
  );

  const row = (pm: RelationshipPM) => toRelationshipRowVM(pm, Routes.member);

  return {
    loading: ready && list === null && !loadError,
    error: loadError,
    notice,
    form: {
      username,
      setUsername: (v: string) => {
        setUsername(v);
        setFormError(null);
      },
      type,
      setType: (v: string) => {
        setType(v);
        setFormError(null);
      },
      choices,
      error: formError,
      busy: busy === "form",
      submit: () => void submit(),
    },
    incoming: (list?.incoming ?? []).map((pm) => ({
      ...row(pm),
      line: copy.incomingLine(pm.label, pm.member.displayName),
      disabled: busy !== null,
      accept: () =>
        void run(pm.id, () => relationshipsApi.accept(pm.id), copy.accepted(pm.member.displayName)),
      decline: () => void run(pm.id, () => relationshipsApi.remove(pm.id), ""),
    })),
    outgoing: (list?.outgoing ?? []).map((pm) => ({
      ...row(pm),
      line: copy.outgoingLine(pm.label, pm.member.displayName),
      disabled: busy !== null,
      cancel: () => void run(pm.id, () => relationshipsApi.remove(pm.id), ""),
    })),
    links: (list?.links ?? []).map((pm) => ({
      ...row(pm),
      disabled: busy !== null,
      end: () => setEnding(pm),
    })),
    endConfirm: {
      open: ending !== null,
      message: ending ? copy.endDialog.message(ending.member.displayName) : "",
      confirmLabel: copy.endDialog.confirm,
      cancelLabel: copy.endDialog.keep,
      busy: busy !== null,
      onConfirm: () => {
        if (!ending) return;
        const pm = ending;
        void run(
          pm.id,
          () => relationshipsApi.remove(pm.id),
          copy.ended(pm.member.displayName),
        ).then(() => setEnding(null));
      },
      onCancel: () => setEnding(null),
    },
    labels: {
      title: copy.title,
      intro: copy.intro,
      form: copy.form,
      incoming: copy.incoming,
      outgoing: copy.outgoing,
      links: copy.links,
      noLinks: copy.noLinks,
      accept: copy.accept,
      decline: copy.decline,
      cancel: copy.cancel,
      end: copy.end,
      loading: copy.loading,
    },
  };
}

export type RelationshipsVM = ReturnType<typeof useRelationshipsPresenter>;
