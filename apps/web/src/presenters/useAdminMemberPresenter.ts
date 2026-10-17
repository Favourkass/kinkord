"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import {
  adminVerificationActions,
  canChangeVerification,
  stepUpMessage,
  stepUpRefusal,
  toAdminMemberDetailVM,
  toAdminMemberVerificationVM,
  twoFactorCodeInput,
  type AdminMemberDetailPM,
  type AdminVerificationStatePM,
} from "@/domain/moderation";
import { ApiError } from "@/services/apiClient";
import { moderationService } from "@/services/moderation.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

export type AdminDialogKind =
  | "assignTeamBadge"
  | "removeTeamBadge"
  | "block"
  | "unblock"
  | "deletePosts"
  | "deletePost"
  | "deleteAccount"
  | "revokeVerification"
  | "reopenVerification";

export interface AdminDialogField {
  label: string;
  value: string;
  set: (v: string) => void;
}

export interface AdminDialogVM {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  /** A short required line above the reason, e.g. an evidence reference. */
  input?: AdminDialogField | null;
  reason: AdminDialogField | null;
  /** A current authenticator code, asked for after the reason. */
  code?: AdminDialogField | null;
  checkbox: { label: string; checked: boolean; toggle: () => void } | null;
  typeToConfirm: AdminDialogField | null;
  canConfirm: boolean;
  busy: boolean;
  error: string | null;
  /** Where to put right what the error says, e.g. Security settings when 2FA is off. */
  errorLink?: { label: string; href: string } | null;
  confirm: () => void;
  cancel: () => void;
}

const STEP_UP_LABELS = {
  expired: MODERATION_COPY.verification.stepUp.expired,
  retryAt: MODERATION_COPY.verification.stepUp.retryAt,
};
const VERIFICATION_LABELS = {
  statuses: MODERATION_COPY.member.verificationStatuses,
  attemptsUsed: MODERATION_COPY.member.attemptsUsed,
  own: MODERATION_COPY.verification.own,
  protected: MODERATION_COPY.verification.protected,
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export function useAdminMemberPresenter(id: string) {
  const router = useRouter();
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY;
  const [member, setMember] = useState<AdminMemberDetailPM | null>(null);
  const [verification, setVerification] = useState<AdminVerificationStatePM | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialog, setDialog] = useState<AdminDialogKind | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [twoFactorOff, setTwoFactorOff] = useState(false);

  // Bumped after every action so the page re-reads what the server now holds.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    moderationService.member(id).then(
      (m) => {
        if (!live) return;
        setMember(m);
        setLoadError(null);
      },
      (e: unknown) => {
        if (live) setLoadError(messageOf(e));
      },
    );
    // Read on its own: the rest of the page works without it, and says when it failed.
    moderationService.memberVerification(id).then(
      (v) => {
        if (!live) return;
        setVerification(v);
        setVerificationError(null);
      },
      () => {
        if (!live) return;
        setVerification(null);
        setVerificationError(MODERATION_COPY.member.verificationError);
      },
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, id, version]);

  const vm = useMemo(() => (member ? toAdminMemberDetailVM(member) : null), [member]);

  const open = useCallback((kind: AdminDialogKind, targetPostId?: string) => {
    setDialog(kind);
    setPostId(targetPostId ?? null);
    setReason("");
    setTwoFactorCode("");
    // Deleting an account also blocks by default: a deleted member who can
    // sign straight back up hasn't really been removed.
    setChecked(kind === "deleteAccount");
    setTyped("");
    setDialogError(null);
    setTwoFactorOff(false);
    setNotice(null);
  }, []);

  const cancel = useCallback(() => {
    if (!busy) setDialog(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!dialog) return;
    setBusy(true);
    setDialogError(null);
    setTwoFactorOff(false);
    const why = reason.trim() || null;
    try {
      if (dialog === "assignTeamBadge" || dialog === "removeTeamBadge") {
        await moderationService.setTeamBadge(id, dialog === "assignTeamBadge");
        setNotice(
          dialog === "assignTeamBadge"
            ? "Kinkord Team badge assigned."
            : "Kinkord Team badge removed.",
        );
      } else if (dialog === "block") {
        const r = await moderationService.block(id, { reason: why, deletePosts: checked });
        setNotice(copy.notices.blocked(r.postsRemoved));
      } else if (dialog === "unblock") {
        await moderationService.unblock(id);
        setNotice(copy.notices.unblocked);
      } else if (dialog === "deletePosts") {
        const r = await moderationService.deleteMemberPosts(id);
        setNotice(copy.notices.postsDeleted(r.postsRemoved));
      } else if (dialog === "deletePost" && postId) {
        await moderationService.deletePost(postId);
        setNotice(copy.notices.postDeleted);
      } else if (dialog === "revokeVerification") {
        await moderationService.stepUpVerification(twoFactorCode);
        await moderationService.revokeVerification(id, reason.trim());
        setNotice(copy.notices.verificationRevoked);
      } else if (dialog === "reopenVerification") {
        await moderationService.stepUpVerification(twoFactorCode);
        await moderationService.reopenVerification(id, reason.trim());
        setNotice(copy.notices.verificationReopened);
      } else if (dialog === "deleteAccount") {
        await moderationService.deleteMember(id, { block: checked, reason: why });
        router.replace(Routes.moderation);
        return;
      }
      setDialog(null);
      setVersion((v) => v + 1);
    } catch (e) {
      const refusal = e instanceof ApiError ? stepUpRefusal(e.status, e.body) : null;
      setDialogError(refusal ? stepUpMessage(refusal, messageOf(e), STEP_UP_LABELS) : messageOf(e));
      setTwoFactorOff(refusal?.kind === "twoFactorOff");
      // A refused code can't be used again; leave the box ready for the next one.
      if (refusal) setTwoFactorCode("");
      // Their verification moved on since this page read it: show it as it is now.
      if (e instanceof ApiError && e.status === 409) setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }, [checked, copy.notices, dialog, id, postId, reason, router, twoFactorCode]);

  const dialogVM = useMemo((): AdminDialogVM | null => {
    if (!dialog || !vm) return null;
    const text = copy.dialogs[dialog];
    const verificationAction = dialog === "revokeVerification" || dialog === "reopenVerification";
    const reasonField =
      dialog === "block" || dialog === "deleteAccount" || verificationAction
        ? { label: copy.dialogs.reasonLabel, value: reason, set: setReason }
        : null;
    const code = verificationAction
      ? {
          label: copy.dialogs.twoFactorCodeLabel,
          value: twoFactorCode,
          set: (value: string) => setTwoFactorCode(twoFactorCodeInput(value)),
        }
      : null;
    // Still on offer as the page reads it now (a refusal reloads it).
    const actions = adminVerificationActions(verification);
    const offered = dialog === "revokeVerification" ? actions.revoke : actions.reopen;
    const checkbox =
      dialog === "block" || dialog === "deleteAccount"
        ? {
            label: copy.dialogs[dialog].checkbox,
            checked,
            toggle: () => setChecked((c) => !c),
          }
        : null;
    const typeToConfirm =
      dialog === "deleteAccount"
        ? {
            label: copy.dialogs.deleteAccount.typeToConfirm(vm.confirmPhrase),
            value: typed,
            set: setTyped,
          }
        : null;
    const phraseOk =
      dialog !== "deleteAccount" ||
      typed.trim().replace(/^@/, "").toLowerCase() === vm.confirmPhrase.toLowerCase();
    return {
      title: text.title,
      body: text.body,
      confirmLabel: text.confirm,
      cancelLabel: copy.dialogs.cancel,
      destructive:
        dialog !== "unblock" && dialog !== "reopenVerification" && dialog !== "assignTeamBadge",
      reason: reasonField,
      code,
      checkbox,
      typeToConfirm,
      canConfirm:
        phraseOk &&
        !busy &&
        (!verificationAction ||
          (offered && canChangeVerification({ code: twoFactorCode, reason }))),
      busy,
      error: dialogError,
      errorLink: twoFactorOff
        ? { label: copy.verification.stepUp.securityLink, href: Routes.settingsSecurity }
        : null,
      confirm: () => void confirm(),
      cancel,
    };
  }, [
    busy,
    cancel,
    checked,
    confirm,
    copy.dialogs,
    copy.verification.stepUp.securityLink,
    dialog,
    dialogError,
    reason,
    twoFactorCode,
    twoFactorOff,
    typed,
    verification,
    vm,
  ]);

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    loading: access.isAdmin && !member && !loadError,
    error: loadError,
    vm,
    verification: verification
      ? toAdminMemberVerificationVM(verification, VERIFICATION_LABELS)
      : null,
    verificationError,
    notice,
    dialog: dialogVM,
    labels: {
      back: copy.member.back,
      posts: copy.member.posts,
      noPosts: copy.member.noPosts,
      rules: copy.member.rules,
      protectedAccount: copy.member.protected,
      verification: copy.member.verification,
      actions: copy.member.actions,
    },
    backHref: Routes.moderation,
    teamBadgeLabels: copy.teamBadge,
    onToggleTeamBadge: () => open(member?.teamMember ? "removeTeamBadge" : "assignTeamBadge"),
    onBlock: () => open("block"),
    onUnblock: () => open("unblock"),
    onDeletePosts: () => open("deletePosts"),
    onDeleteAccount: () => open("deleteAccount"),
    onDeletePost: (targetPostId: string) => open("deletePost", targetPostId),
    onRevokeVerification: () => open("revokeVerification"),
    onReopenVerification: () => open("reopenVerification"),
  };
}
