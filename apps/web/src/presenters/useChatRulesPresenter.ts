"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAT_RULES } from "@/domain/chatRules";
import { chatRulesStore } from "@/util/chatRules";

/**
 * Owns the "should this member see the rule right now" decision and the
 * dismissal. Renders nothing itself — the layout renders the gate when
 * `visible` is true.
 *
 * The check runs in an effect rather than at render, because storage is not
 * available during SSR; doing it at render would desync the server HTML from
 * the first client paint and hydrate a flash of the modal.
 */
export function useChatRulesPresenter() {
  const [visible, setVisible] = useState(false);
  const [neverShow, setNeverShow] = useState(false);

  useEffect(() => {
    // One-time read of browser storage, which is unavailable during SSR. The
    // first paint must be server-consistent (no gate), so the check cannot run
    // during render. This is a single flip on mount, not a cascading update —
    // `useSyncExternalStore` would be the "correct" primitive but the store has
    // no other subscribers and would need a listener map just for this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!chatRulesStore.isAcknowledged()) setVisible(true);
  }, []);

  const acknowledge = useCallback(() => {
    chatRulesStore.acknowledge(neverShow);
    setVisible(false);
  }, [neverShow]);

  return {
    visible,
    /** Bound to the checkbox in the gate's footer. */
    neverShow,
    setNeverShow,
    acknowledge,
    /** Content, kept here so the layout only passes one object. */
    copy: CHAT_RULES,
  };
}
