"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import {
  toBlockRuleVM,
  validateNewRule,
  type BlockRuleAction,
  type BlockRuleKind,
  type BlockRulePM,
  type NewBlockRulePM,
} from "@/domain/moderation";
import { moderationService } from "@/services/moderation.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

const EMPTY_DRAFT: NewBlockRulePM = { kind: "email", value: "", action: "block", reason: null };

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export function useBlocklistPresenter() {
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY.blocklist;
  const [rules, setRules] = useState<BlockRulePM[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewBlockRulePM>(EMPTY_DRAFT);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    moderationService.rules().then(
      (r) => live && setRules(r),
      (e: unknown) => live && setError(messageOf(e)),
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin]);

  const setKind = useCallback((kind: BlockRuleKind) => {
    // IPs are shared on mobile networks and name fragments are fuzzy, so both
    // default to flagging; emails and phones are exact, so they default to block.
    setDraft((d) => ({
      ...d,
      kind,
      action: kind === "email" || kind === "phone" ? "block" : "flag",
    }));
    setDraftError(null);
  }, []);

  const add = useCallback(async () => {
    const problem = validateNewRule(draft);
    if (problem) {
      setDraftError(problem);
      return;
    }
    setBusy(true);
    setDraftError(null);
    try {
      const rule = await moderationService.addRule({
        ...draft,
        value: draft.value.trim(),
        reason: draft.reason?.trim() || null,
      });
      setRules((current) => [rule, ...(current ?? []).filter((r) => r.id !== rule.id)]);
      setDraft((d) => ({ ...d, value: "", reason: null }));
    } catch (e) {
      setDraftError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const remove = useCallback(async (id: string) => {
    setRemoving(id);
    try {
      await moderationService.removeRule(id);
      setRules((current) => (current ?? []).filter((r) => r.id !== id));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setRemoving(null);
    }
  }, []);

  const hint = copy.kinds.find((k) => k.value === draft.kind)?.hint ?? "";
  const rows = useMemo(() => (rules ?? []).map((r) => toBlockRuleVM(r)), [rules]);

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    loading: access.isAdmin && rules === null && !error,
    error,
    rows,
    empty: rules !== null && rules.length === 0,
    removing,
    remove: (id: string) => void remove(id),
    form: {
      kind: draft.kind,
      value: draft.value,
      action: draft.action,
      reason: draft.reason ?? "",
      hint,
      error: draftError,
      busy,
      kinds: copy.kinds,
      actions: copy.actions,
      setKind,
      setValue: (value: string) => setDraft((d) => ({ ...d, value })),
      setAction: (action: BlockRuleAction) => setDraft((d) => ({ ...d, action })),
      setReason: (reason: string) => setDraft((d) => ({ ...d, reason })),
      submit: () => void add(),
    },
    labels: {
      intro: copy.intro,
      kind: copy.kindLabel,
      value: copy.valueLabel,
      action: copy.actionLabel,
      reason: copy.reasonLabel,
      add: copy.add,
      remove: copy.remove,
      empty: copy.empty,
    },
  };
}
