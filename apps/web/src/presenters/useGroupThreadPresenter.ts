"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GROUPS_COPY } from "@/constants/groups";
import { Routes } from "@/constants/Routes";
import type { GroupPM } from "@/domain/group";
import { toCommentVM, toPostVM, type CommentPM, type PostPM } from "@/domain/post";
import { ApiError } from "@/services/apiClient";
import { groupsService } from "@/services/groups.service";
import { canSubmitComment, postsApi } from "@/services/posts.service";

const copy = GROUPS_COPY.thread;
const REPLIES_PAGE = 20;
const memberHref = (username: string | null) => (username ? Routes.member(username) : null);

type Confirm = { kind: "thread" } | { kind: "reply"; id: string };

/** One group discussion: the post, its replies oldest first, and the moderators' tools. */
export function useGroupThreadPresenter(slug: string, postId: string) {
  const router = useRouter();
  const [group, setGroup] = useState<GroupPM | null>(null);
  const [thread, setThread] = useState<PostPM | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replies, setReplies] = useState<CommentPM[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [repliesLoaded, setRepliesLoaded] = useState("");
  const [moreLoading, setMoreLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const signedOut = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(Routes.login);
        return true;
      }
      return false;
    },
    [router],
  );
  const fail = useCallback(
    (e: unknown) => {
      if (!signedOut(e))
        setError(e instanceof ApiError && e.status !== 0 ? e.message : GROUPS_COPY.group.error);
    },
    [signedOut],
  );

  useEffect(() => {
    let live = true;
    groupsService.thread(slug, postId).then(
      (res) => {
        if (!live) return;
        setGroup(res.group);
        setThread(res.thread);
      },
      (e) => {
        if (!live || signedOut(e)) return;
        setLoadError(
          e instanceof ApiError && e.status === 403 ? GROUPS_COPY.group.closedNote : copy.notFound,
        );
      },
    );
    return () => {
      live = false;
    };
  }, [slug, postId, signedOut]);

  useEffect(() => {
    if (!thread) return;
    let live = true;
    postsApi.comments(postId, null, REPLIES_PAGE, "oldest").then(
      (res) => {
        if (!live) return;
        setReplies(res.items);
        setCursor(res.nextCursor);
        setRepliesLoaded(postId);
      },
      (e) => {
        if (!live) return;
        setRepliesLoaded(postId);
        fail(e);
      },
    );
    return () => {
      live = false;
    };
    // Replies load once the discussion has; a later change to it doesn't reload them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, Boolean(thread), fail]);

  const act = async (key: string, run: () => Promise<unknown>, after?: () => void) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await run();
      after?.();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const repliesLoading = moreLoading || (Boolean(thread) && repliesLoaded !== postId);

  const moreReplies = () => {
    if (!cursor || moreLoading) return;
    setMoreLoading(true);
    postsApi
      .comments(postId, cursor, REPLIES_PAGE, "oldest")
      .then((res) => {
        setReplies((shown) => [
          ...shown,
          ...res.items.filter((r) => !shown.some((s) => s.id === r.id)),
        ]);
        setCursor(res.nextCursor);
      }, fail)
      .finally(() => setMoreLoading(false));
  };

  const send = async () => {
    if (sending || !canSubmitComment(draft)) return;
    setSending(true);
    setError(null);
    try {
      const reply = await postsApi.comment(postId, draft.trim());
      setDraft("");
      // Oldest first: a new reply goes at the end once the end is on screen.
      if (!cursor) setReplies((list) => [...list, reply]);
      setThread((t) => (t ? { ...t, comments: t.comments + 1 } : t));
    } catch (e) {
      fail(e);
    } finally {
      setSending(false);
    }
  };

  const toggleLike = () => {
    if (!thread) return;
    const was = thread.likedByMe;
    void act("like", async () => {
      const res = was ? await postsApi.unlike(postId) : await postsApi.like(postId);
      setThread((t) => (t ? { ...t, likes: res.likes, likedByMe: res.likedByMe } : t));
    });
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "thread")
      void act(
        "remove",
        () => groupsService.removeThread(slug, postId),
        () => router.push(Routes.group(slug)),
      );
    else {
      const { id } = confirm;
      void act(
        `reply:${id}`,
        () => postsApi.removeComment(id),
        () => {
          setConfirm(null);
          setReplies((list) => list.filter((r) => r.id !== id));
          setThread((t) => (t ? { ...t, comments: Math.max(0, t.comments - 1) } : t));
        },
      );
    }
  };

  const access = group?.access;
  const moderators = new Set((group?.team ?? []).map((p) => p.userId));
  const vm = thread ? toPostVM(thread, true, memberHref) : null;
  const canReply = Boolean(access?.canPost && thread && !thread.closed);

  return {
    loading: !thread && !loadError,
    loadError,
    back: { label: copy.back(group?.name ?? GROUPS_COPY.group.back), href: Routes.group(slug) },
    error,
    thread:
      thread && vm
        ? {
            title: thread.title ?? "",
            authorName: vm.authorName,
            authorHref: vm.authorHref,
            avatarUrl: vm.avatarUrl,
            authorSilver: vm.authorSilver,
            authorTeamMember: Boolean(vm.authorTeamMember),
            authorLabel: moderators.has(thread.author.userId) ? copy.mod : null,
            time: vm.time,
            bodyParts: vm.bodyParts,
            media: vm.media,
            pinned: thread.pinned ? GROUPS_COPY.group.pinned : null,
            closed: thread.closed ? GROUPS_COPY.group.closed : null,
            likes: vm.likes,
            likedByMe: thread.likedByMe,
            likeLabel: copy.like,
            onLike: access?.canPost ? toggleLike : null,
            replies: GROUPS_COPY.group.replies(thread.comments),
          }
        : null,
    onOpenMedia: (media: { id: string }) => setLightbox(media.id),
    lightbox: {
      media: vm?.media.find((m) => m.id === lightbox) ?? null,
      onClose: () => setLightbox(null),
      closeLabel: copy.closePhoto,
    },
    /** Pin, close and remove for moderators; remove for the author. */
    actions: thread
      ? [
          ...(access?.canModerate
            ? [
                {
                  key: "pin",
                  label: thread.pinned ? copy.unpin : copy.pin,
                  busy: busy === "pin",
                  onClick: () =>
                    void act("pin", async () => {
                      await groupsService.pin(slug, postId, !thread.pinned);
                      setThread((t) => (t ? { ...t, pinned: !t.pinned } : t));
                    }),
                },
                {
                  key: "close",
                  label: thread.closed ? copy.reopen : copy.close,
                  busy: busy === "close",
                  onClick: () =>
                    void act("close", async () => {
                      await groupsService.close(slug, postId, !thread.closed);
                      setThread((t) => (t ? { ...t, closed: !t.closed } : t));
                    }),
                },
              ]
            : []),
          ...(access?.canModerate || thread.mine
            ? [
                {
                  key: "remove",
                  label: copy.remove,
                  busy: busy === "remove",
                  onClick: () => setConfirm({ kind: "thread" }),
                },
              ]
            : []),
        ]
      : [],
    replies: {
      title: copy.replies,
      rows: replies.map((r) => {
        const c = toCommentVM(r, memberHref);
        return {
          id: c.id,
          authorName: c.authorName,
          authorHref: c.authorHref,
          avatarUrl: c.avatarUrl,
          authorSilver: c.authorSilver,
          time: c.time,
          bodyParts: c.bodyParts,
          label:
            thread && r.author.userId === thread.author.userId
              ? copy.op
              : moderators.has(r.author.userId)
                ? copy.mod
                : null,
          remove: c.canDelete
            ? {
                label: copy.removeReply,
                busy: busy === `reply:${c.id}`,
                onClick: () => setConfirm({ kind: "reply", id: c.id }),
              }
            : null,
        };
      }),
      empty: !repliesLoading && replies.length === 0 ? copy.noReplies : null,
      more: cursor ? { label: copy.loadMore, onClick: moreReplies } : null,
    },
    composer: canReply
      ? {
          value: draft,
          placeholder: copy.replyPlaceholder,
          onChange: setDraft,
          submit: {
            label: sending ? copy.sending : copy.reply,
            disabled: sending || !canSubmitComment(draft),
            onClick: () => void send(),
          },
        }
      : null,
    composerNote: !thread
      ? null
      : thread.closed
        ? copy.closedNote
        : !access?.canPost
          ? copy.joinToReply
          : null,
    confirm: {
      open: confirm !== null,
      message: confirm?.kind === "thread" ? copy.removeConfirm : copy.removeReplyConfirm,
      confirmLabel: copy.remove,
      cancelLabel: GROUPS_COPY.composer.cancel,
      busy: busy !== null,
      onConfirm: runConfirm,
      onCancel: () => setConfirm(null),
    },
  };
}
