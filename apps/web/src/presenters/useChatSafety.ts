"use client";

import { useCallback, useState } from "react";
import {
  alsoBlockText,
  blockConfirmText,
  blockedNoticeText,
  CHAT_COPY,
  reportTitle,
} from "@/constants/chat";
import type { ChatPeerPM } from "@/domain/chat";
import {
  EMPTY_REPORT,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  toReportInput,
  type ReportDraft,
  type ReportReason,
} from "@/domain/safety";
import { ApiError } from "@/services/apiClient";
import { safetyService } from "@/services/safety.service";

export type ThreadMenuAction = "report" | "block" | "unblock";

function failure(e: unknown): string {
  return e instanceof ApiError ? e.message : CHAT_COPY.safetyFailed;
}

/**
 * Reporting and blocking from a thread's header. `onChange` refreshes the
 * thread once a block is made or lifted, so its header and composer follow.
 * Composed into the thread presenter rather than called by a screen.
 */
export function useChatSafety(
  conversationId: string,
  peer: ChatPeerPM | null,
  onChange: () => void,
) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_REPORT);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const block = useCallback(async () => {
    if (!peer) return;
    setBusy(true);
    setError(null);
    try {
      await safetyService.block(peer.userId);
      setConfirmingBlock(false);
      onChange();
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }, [peer, onChange]);

  const unblock = useCallback(async () => {
    if (!peer) return;
    setBusy(true);
    setError(null);
    try {
      await safetyService.unblock(peer.userId);
      onChange();
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }, [peer, onChange]);

  const select = useCallback(
    (action: ThreadMenuAction) => {
      setMenuOpen(false);
      if (action === "report") {
        // Blocking in the same step is on, unless they're blocked already.
        setDraft({ ...EMPTY_REPORT, block: !peer?.blockedByMe });
        setSent(false);
        setReportError(null);
        setReportOpen(true);
      } else if (action === "block") {
        setConfirmingBlock(true);
      } else {
        void unblock();
      }
    },
    [peer, unblock],
  );

  const submitReport = useCallback(async () => {
    if (!peer) return;
    const input = toReportInput(draft, peer.userId, conversationId);
    if (!input) return;
    setSending(true);
    setReportError(null);
    try {
      await safetyService.report(input);
      setSent(true);
      if (input.block) onChange();
    } catch (e) {
      setReportError(failure(e));
    } finally {
      setSending(false);
    }
  }, [conversationId, draft, onChange, peer]);

  const name = peer?.displayName ?? "";
  const items: Array<{ key: ThreadMenuAction; label: string; danger: boolean }> = [
    { key: "report", label: CHAT_COPY.menuReport, danger: false },
    peer?.blockedByMe
      ? { key: "unblock", label: CHAT_COPY.menuUnblock, danger: false }
      : { key: "block", label: CHAT_COPY.menuBlock, danger: true },
  ];

  return {
    menu: peer
      ? {
          open: menuOpen,
          label: CHAT_COPY.menu,
          items,
          onToggle: () => setMenuOpen((o) => !o),
          onClose: () => setMenuOpen(false),
          onSelect: select,
        }
      : null,
    blockDialog:
      peer && confirmingBlock
        ? {
            message: blockConfirmText(name),
            confirmLabel: CHAT_COPY.blockConfirm,
            cancelLabel: CHAT_COPY.cancel,
            busy,
            onConfirm: () => void block(),
            onCancel: () => setConfirmingBlock(false),
          }
        : null,
    /** In place of the composer while the viewer has them blocked. */
    blocked: peer?.blockedByMe
      ? {
          text: blockedNoticeText(name),
          actionLabel: CHAT_COPY.unblock,
          busy,
          onAction: () => void unblock(),
        }
      : null,
    report:
      peer && reportOpen
        ? {
            title: reportTitle(name),
            intro: CHAT_COPY.report.intro,
            reasons: REPORT_REASONS.map((value) => ({
              value,
              label: CHAT_COPY.report.reasons[value],
            })),
            selected: draft.reason,
            details: draft.details,
            detailsLabel: CHAT_COPY.report.detailsLabel,
            detailsMax: REPORT_DETAILS_MAX,
            alsoBlock: peer.blockedByMe
              ? null
              : { label: alsoBlockText(name), checked: draft.block },
            submitLabel: sending ? CHAT_COPY.report.sending : CHAT_COPY.report.submit,
            cancelLabel: CHAT_COPY.cancel,
            canSubmit: draft.reason !== null && !sending,
            sent,
            doneText: CHAT_COPY.report.done,
            closeLabel: CHAT_COPY.report.close,
            error: reportError,
            onReason: (reason: ReportReason) => setDraft((d) => ({ ...d, reason })),
            onDetails: (details: string) => setDraft((d) => ({ ...d, details })),
            onToggleBlock: () => setDraft((d) => ({ ...d, block: !d.block })),
            onSubmit: () => void submitReport(),
            onClose: () => setReportOpen(false),
          }
        : null,
    error,
  };
}
