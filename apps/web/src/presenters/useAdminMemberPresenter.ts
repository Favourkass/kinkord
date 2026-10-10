"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import {
  adminVerificationActions,
  toAdminMemberDetailVM,
  type AdminMemberDetailPM,
  type AdminVerificationStatePM,
} from "@/domain/moderation";
import { moderationService } from "@/services/moderation.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

export type AdminDialogKind =
  | "block"
  | "unblock"
  | "deletePosts"
  | "deletePost"
  | "deleteAccount"
  | "revokeVerification"
  | "reopenVerification";

export interface AdminDialogVM {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  /** A short required line above the reason, e.g. an evidence reference. */
  input?: { label: string; value: string; set: (v: string) => void } | null;
  reason: { label: string; value: string; set: (v: string) => void } | null;
  checkbox: { label: string; checked: boolean; toggle: () => void } | null;
  typeToConfirm: { label: string; value: string; set: (v: string) => void } | null;
  canConfirm: boolean;
  busy: boolean;
  error: string | null;
  confirm: () => void;
  cancel: () => void;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export function useAdminMemberPresenter(id: string) {
  const router = useRouter();
  const access = useAdminAccessPresenter();
  const copy = MODERATION_COPY;
  const [member, setMember] = useState<AdminMemberDetailPM | null>(null);
  const [verification, setVerification] = useState<AdminVerificationStatePM | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialog, setDialog] = useState<AdminDialogKind | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

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
    // Secondary: the page still works if this one read fails.
    moderationService.memberVerification(id).then(
      (v) => live && setVerification(v),
      () => live && setVerification(null),
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
    // Deleting an account also blocks by default: a deleted member who can
    // sign straight back up hasn't really been removed.
    setChecked(kind === "deleteAccount");
    setTyped("");
    setDialogError(null);
    setNotice(null);
  }, []);

  const cancel = useCallback(() => {
    if (!busy) setDialog(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!dialog) return;
    setBusy(true);
    setDialogError(null);
    const why = reason.trim() || null;
    try {
      if (dialog === "block") {
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
        await moderationService.revokeVerification(id);
        setNotice(copy.notices.verificationRevoked);
      } else if (dialog === "reopenVerification") {
        await moderationService.reopenVerification(id);
        setNotice(copy.notices.verificationReopened);
      } else if (dialog === "deleteAccount") {
        await moderationService.deleteMember(id, { block: checked, reason: why });
        router.replace(Routes.moderation);
        return;
      }
      setDialog(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setDialogError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [checked, copy.notices, dialog, id, postId, reason, router]);

  const dialogVM = useMemo((): AdminDialogVM | null => {
    if (!dialog || !vm) return null;
    const text = copy.dialogs[dialog];
    const reasonField =
      dialog === "block" || dialog === "deleteAccount"
        ? { label: copy.dialogs.reasonLabel, value: reason, set: setReason }
        : null;
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
      destructive: dialog !== "unblock" && dialog !== "reopenVerification",
      reason: reasonField,
      checkbox,
      typeToConfirm,
      canConfirm: phraseOk && !busy,
      busy,
      error: dialogError,
      confirm: () => void confirm(),
      cancel,
    };
  }, [busy, cancel, checked, confirm, copy.dialogs, dialog, dialogError, reason, typed, vm]);

  return {
    checking: access.checking,
    isAdmin: access.isAdmin,
    loading: access.isAdmin && !member && !loadError,
    error: loadError,
    vm,
    verification: verification
      ? {
          label: copy.member.verification,
          status: copy.member.verificationStatuses[verification.status] ?? verification.status,
          attempts: copy.member.attemptsUsed(verification.attemptsUsed),
          ...adminVerificationActions(verification),
        }
      : null,
    notice,
    dialog: dialogVM,
    labels: {
      back: copy.member.back,
      posts: copy.member.posts,
      noPosts: copy.member.noPosts,
      rules: copy.member.rules,
      protectedAccount: copy.member.protected,
      actions: copy.member.actions,
    },
    backHref: Routes.moderation,
    onBlock: () => open("block"),
    onUnblock: () => open("unblock"),
    onDeletePosts: () => open("deletePosts"),
    onDeleteAccount: () => open("deleteAccount"),
    onDeletePost: (targetPostId: string) => open("deletePost", targetPostId),
    onRevokeVerification: () => open("revokeVerification"),
    onReopenVerification: () => open("reopenVerification"),
  };
}
