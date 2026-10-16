"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAT_RULES } from "@/constants/chatRules";
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
    // Browser storage is unavailable during SSR, so the first paint has no gate
    // and the check runs after mount. It shows on a tab's first visit to
    // Messages, and again for each chat with someone the member hasn't written
    // to yet, unless they ticked "Never show this again".
    const check = () =>
      setVisible(
        !chatRulesStore.isOffForever() &&
          (!chatRulesStore.isAcknowledged() || chatRulesStore.pendingNewChat() !== null),
      );
    check();
    return chatRulesStore.subscribe(check);
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
