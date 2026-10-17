"use client";
import { useEffect, useMemo, useState } from "react";
import {
  toAdminPostsVM,
  type AdminPostPM,
  type AdminPostsPM,
  type AdminPostStatus,
} from "@/domain/adminPosts";
import { adminPostsService } from "@/services/adminPosts.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";
import type { AdminDialogVM } from "./useAdminMemberPresenter";

export function useAdminPostsPresenter() {
  const access = useAdminAccessPresenter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AdminPostStatus>("all");
  const [data, setData] = useState<AdminPostsPM | null>(null);
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState<{
    post: AdminPostPM;
    action: "archive" | "restore" | "delete";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const key = `${page}:${status}:${version}`;
  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    adminPostsService.list(page, status).then(
      (pm) => {
        if (!live) return;
        setData(pm);
        setLoaded(key);
        setError(null);
      },
      (e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Could not load posts.");
        setLoaded(key);
      },
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin, page, status, key]);
  const vm = useMemo(() => (data ? toAdminPostsVM(data) : null), [data]);
  const ask = (post: AdminPostPM, action: "archive" | "restore" | "delete") => {
    setPending({ post, action });
    setActionError(null);
  };
  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.action === "delete") await adminPostsService.remove(pending.post.id);
      else await adminPostsService.archive(pending.post.id, pending.action === "archive");
      setPending(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not update this post.");
    } finally {
      setBusy(false);
    }
  };
  const action = pending?.action;
  const dialog: AdminDialogVM | null = pending
    ? {
        title:
          action === "delete"
            ? "Delete this post?"
            : action === "restore"
              ? "Restore this post?"
              : "Archive this post?",
        body:
          action === "delete"
            ? "The post is removed and its media is deleted. This cannot be undone. Use Archive to hide it reversibly."
            : action === "restore"
              ? "This returns the post to its original visibility and location rules."
              : "This hides the post from member feeds, search, profiles and media. Admins can still review and restore it.",
        confirmLabel:
          action === "delete"
            ? "Delete post"
            : action === "restore"
              ? "Restore post"
              : "Archive post",
        cancelLabel: "Cancel",
        destructive: action === "delete",
        reason: null,
        checkbox: null,
        typeToConfirm: null,
        canConfirm: !busy,
        busy,
        error: actionError,
        confirm: () => void confirm(),
        cancel: () => {
          if (!busy) setPending(null);
        },
      }
    : null;
  return {
    ...access,
    vm,
    error,
    loading: access.isAdmin && loaded !== key,
    status,
    dialog,
    busy,
    setStatus: (next: AdminPostStatus) => {
      setStatus(next);
      setPage(1);
    },
    previous: () => setPage(Math.max(1, (data?.page ?? page) - 1)),
    next: () => setPage((data?.page ?? page) + 1),
    retry: () => setVersion((v) => v + 1),
    onArchive: (post: AdminPostPM) => ask(post, post.archivedAt ? "restore" : "archive"),
    onDelete: (post: AdminPostPM) => ask(post, "delete"),
  };
}
