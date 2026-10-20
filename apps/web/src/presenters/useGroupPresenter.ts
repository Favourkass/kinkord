"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_CATEGORY_LABELS, GROUP_LABELS, GROUPS_COPY } from "@/constants/groups";
import { Routes } from "@/constants/Routes";
import {
  canSubmitThread,
  groupTabs,
  placeLabel,
  primaryAction,
  toThreadRowVM,
  type GroupAction,
  type GroupMemberPM,
  type GroupPM,
  type GroupTab,
} from "@/domain/group";
import { POST_MEDIA_MAX, type PostPM } from "@/domain/post";
import { ApiError } from "@/services/apiClient";
import { groupsService } from "@/services/groups.service";
import { countryName, shortDate, timeAgo } from "@/util/format";

const copy = GROUPS_COPY.group;

type Confirm =
  { kind: "leave" } | { kind: "closeDown" } | { kind: "remove"; userId: string; name: string };

interface DraftPhoto {
  file: File;
  url: string;
}

const isTab = (v: string | null | undefined): v is GroupTab =>
  v === "discussions" || v === "about" || v === "members" || v === "requests";

const memberHref = (username: string | null) => (username ? Routes.member(username) : null);

/** A group's page: who it is, joining, its discussions, members and requests. */
export function useGroupPresenter(slug: string, initialTab?: string | null) {
  const router = useRouter();
  const [group, setGroup] = useState<GroupPM | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<GroupTab>(isTab(initialTab) ? initialTab : "discussions");
  const [threads, setThreads] = useState<PostPM[]>([]);
  const [threadsCursor, setThreadsCursor] = useState<string | null>(null);
  const [threadsLoaded, setThreadsLoaded] = useState("");
  const [moreLoading, setMoreLoading] = useState(false);
  const [members, setMembers] = useState<GroupMemberPM[]>([]);
  const [membersPage, setMembersPage] = useState(1);
  const [membersMore, setMembersMore] = useState(false);
  const [requests, setRequests] = useState<GroupMemberPM[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const photoUrls = useRef<string[]>([]);

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
      if (!signedOut(e)) setError(e instanceof ApiError && e.status !== 0 ? e.message : copy.error);
    },
    [signedOut],
  );

  useEffect(() => {
    let live = true;
    groupsService.detail(slug).then(
      (g) => {
        if (!live) return;
        setGroup(g);
        setLoadError(null);
      },
      (e) => {
        if (!live || signedOut(e)) return;
        setLoadError(e instanceof ApiError && e.status === 404 ? copy.notFound : copy.error);
      },
    );
    return () => {
      live = false;
    };
  }, [slug, reload, signedOut]);

  const canRead = Boolean(group?.access.canRead);
  const canModerate = Boolean(group?.access.canModerate);
  const threadsLoading =
    moreLoading || (canRead && tab === "discussions" && threadsLoaded !== `${slug}|${reload}`);

  useEffect(() => {
    if (!canRead || tab !== "discussions") return;
    let live = true;
    const key = `${slug}|${reload}`;
    groupsService.threads(slug).then(
      (res) => {
        if (!live) return;
        setThreads(res.items);
        setThreadsCursor(res.nextCursor);
        setThreadsLoaded(key);
      },
      (e) => {
        if (!live) return;
        setThreadsLoaded(key);
        fail(e);
      },
    );
    return () => {
      live = false;
    };
  }, [slug, tab, canRead, reload, fail]);

  useEffect(() => {
    if (!canRead || tab !== "members") return;
    let live = true;
    groupsService.members(slug, "active").then(
      (res) => {
        if (!live) return;
        setMembers(res.items);
        setMembersMore(res.hasMore);
        setMembersPage(1);
      },
      (e) => live && fail(e),
    );
    return () => {
      live = false;
    };
  }, [slug, tab, canRead, reload, fail]);

  useEffect(() => {
    if (!canModerate || tab !== "requests") return;
    let live = true;
    groupsService.members(slug, "pending").then(
      (res) => live && setRequests(res.items),
      (e) => live && fail(e),
    );
    return () => {
      live = false;
    };
  }, [slug, tab, canModerate, reload, fail]);

  // Object URLs outlive React state; they're let go of by hand.
  useEffect(() => () => photoUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

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

  const refresh = () => setReload((n) => n + 1);

  const onPrimary = (action: GroupAction) => {
    if (action === "leave") return setConfirm({ kind: "leave" });
    void act(
      "membership",
      () => (action === "cancel" ? groupsService.leave(slug) : groupsService.join(slug)),
      refresh,
    );
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "leave")
      void act(
        "membership",
        () => groupsService.leave(slug),
        () => {
          setConfirm(null);
          setTab("discussions");
          refresh();
        },
      );
    if (confirm.kind === "closeDown")
      void act(
        "closeDown",
        () => groupsService.closeDown(slug),
        () => router.push(Routes.groups),
      );
    if (confirm.kind === "remove") {
      const { userId } = confirm;
      void act(
        `remove:${userId}`,
        () => groupsService.removeMember(slug, userId),
        () => {
          setConfirm(null);
          setMembers((list) => list.filter((m) => m.userId !== userId));
        },
      );
    }
  };

  const moreThreads = () => {
    if (!threadsCursor || moreLoading) return;
    setMoreLoading(true);
    groupsService
      .threads(slug, threadsCursor)
      .then((res) => {
        setThreads((shown) => [
          ...shown,
          ...res.items.filter((t) => !shown.some((s) => s.id === t.id)),
        ]);
        setThreadsCursor(res.nextCursor);
      }, fail)
      .finally(() => setMoreLoading(false));
  };

  const moreMembers = () =>
    void act("members", async () => {
      const res = await groupsService.members(slug, "active", membersPage + 1);
      setMembers((shown) => [
        ...shown,
        ...res.items.filter((m) => !shown.some((s) => s.userId === m.userId)),
      ]);
      setMembersMore(res.hasMore);
      setMembersPage((p) => p + 1);
    });

  const addPhotos = (files: File[]) => {
    const room = POST_MEDIA_MAX - photos.length;
    const added = files.slice(0, Math.max(0, room)).map((file) => {
      const url = URL.createObjectURL(file);
      photoUrls.current.push(url);
      return { file, url };
    });
    setPhotos((list) => [...list, ...added]);
  };

  const resetComposer = () => {
    setComposerOpen(false);
    setTitle("");
    setBody("");
    setPhotos([]);
    setComposerError(null);
  };

  const postThread = async () => {
    if (posting || !canSubmitThread(title, body)) return;
    setPosting(true);
    setComposerError(null);
    try {
      const created = await groupsService.createThread(slug, {
        title,
        body,
        photos: photos.map((p) => p.file),
      });
      resetComposer();
      router.push(Routes.groupThread(slug, created.postId));
    } catch (e) {
      if (!signedOut(e))
        setComposerError(
          e instanceof ApiError && e.status !== 0 ? e.message : GROUPS_COPY.composer.error,
        );
    } finally {
      setPosting(false);
    }
  };

  const viewerAction = group ? primaryAction(group.access, group.privacy) : null;
  const tabs = group ? groupTabs(group.access, group.privacy) : [];
  const activeTab = tabs.includes(tab) ? tab : "discussions";
  const now = new Date();
  const ago = (iso: string | null | undefined) => timeAgo(iso, now);

  return {
    loading: !group && !loadError,
    loadError,
    backHref: Routes.groups,
    backLabel: copy.back,
    header: group
      ? {
          name: group.name,
          meta: [
            GROUP_CATEGORY_LABELS[group.category],
            placeLabel(group.state, group.country, countryName),
          ]
            .filter(Boolean)
            .join(" · "),
          members: GROUPS_COPY.members(group.members),
          privacy: GROUPS_COPY.privacy[group.privacy],
          closed: group.privacy === "closed",
          badge: group.access.member && group.role ? GROUP_LABELS.roles[group.role] : null,
        }
      : null,
    primary: viewerAction
      ? {
          label: {
            join: copy.join,
            ask: copy.ask,
            cancel: copy.cancelRequest,
            leave: copy.leave,
          }[viewerAction],
          quiet: viewerAction === "leave" || viewerAction === "cancel",
          busy: busy === "membership",
          onClick: () => onPrimary(viewerAction),
        }
      : null,
    editHref: canModerate ? Routes.groupEdit(slug) : null,
    editLabel: copy.edit,
    closeDown: group?.access.isOwner
      ? { label: copy.closeDown, onClick: () => setConfirm({ kind: "closeDown" }) }
      : null,
    note: !group
      ? null
      : group.access.pending
        ? copy.pendingNote
        : !group.access.canRead
          ? copy.closedNote
          : null,
    tabs: tabs.map((key) => ({
      key,
      label:
        key === "requests" && group?.requests
          ? `${copy.tabs.requests} (${group.requests})`
          : copy.tabs[key],
    })),
    tab: activeTab,
    setTab: (key: string) => isTab(key) && setTab(key),
    error,
    discussions: {
      canPost: Boolean(group?.access.canPost),
      joinNote: group && canRead && !group.access.canPost ? copy.joinToPost : null,
      newLabel: copy.newDiscussion,
      rows: threads.map((pm) =>
        toThreadRowVM(pm, Routes.groupThread(slug, pm.postId), copy.replies, ago),
      ),
      labels: { pinned: copy.pinned, closed: copy.closed },
      empty: canRead && !threadsLoading && threads.length === 0 ? copy.noDiscussions : null,
      loading: threadsLoading,
      loadingText: GROUPS_COPY.loading,
      more: threadsCursor ? { label: GROUPS_COPY.loadMore, onClick: moreThreads } : null,
      composer: {
        open: composerOpen,
        onOpen: () => setComposerOpen(true),
        heading: GROUPS_COPY.composer.title,
        title: {
          label: GROUPS_COPY.composer.titleLabel,
          placeholder: GROUPS_COPY.composer.titlePlaceholder,
          value: title,
          onChange: setTitle,
        },
        body: {
          label: GROUPS_COPY.composer.bodyLabel,
          placeholder: GROUPS_COPY.composer.bodyPlaceholder,
          value: body,
          onChange: setBody,
        },
        photos: photos.map((p, i) => ({
          url: p.url,
          onRemove: () => setPhotos((list) => list.filter((_, j) => j !== i)),
        })),
        addPhotosLabel: GROUPS_COPY.composer.addPhotos,
        canAddPhotos: photos.length < POST_MEDIA_MAX,
        onAddPhotos: addPhotos,
        submit: {
          label: posting ? GROUPS_COPY.composer.posting : GROUPS_COPY.composer.post,
          disabled: posting || !canSubmitThread(title, body),
          onClick: () => void postThread(),
        },
        cancel: { label: GROUPS_COPY.composer.cancel, onClick: resetComposer },
        error: composerError,
      },
    },
    about: group
      ? {
          aboutTitle: copy.aboutTitle,
          description: group.description,
          rulesTitle: copy.rulesTitle,
          rules: group.rules ?? copy.noRules,
          privacyHint: GROUPS_COPY.privacyHint[group.privacy],
          teamTitle: copy.teamTitle,
          team: group.team.map((p) => ({
            userId: p.userId,
            name: p.displayName,
            href: memberHref(p.username),
            avatarUrl: p.avatarUrl,
            role: GROUP_LABELS.roles[p.role],
          })),
          created: copy.created(shortDate(group.createdAt) ?? ""),
        }
      : null,
    members: {
      rows: members.map((m) => {
        // Never the owner, and a moderator only by the owner. (That also keeps
        // anyone from being offered to remove themselves.)
        const removable =
          canModerate && m.role !== "owner" && (m.role !== "moderator" || group?.access.isOwner);
        return {
          userId: m.userId,
          name: m.displayName,
          href: memberHref(m.username),
          avatarUrl: m.avatarUrl,
          role: m.role === "member" ? null : GROUP_LABELS.roles[m.role],
          remove: removable
            ? {
                label: copy.remove,
                busy: busy === `remove:${m.userId}`,
                onClick: () =>
                  setConfirm({ kind: "remove", userId: m.userId, name: m.displayName }),
              }
            : null,
          moderator:
            group?.access.isOwner && m.role !== "owner"
              ? {
                  label: m.role === "moderator" ? copy.removeModerator : copy.makeModerator,
                  busy: busy === `role:${m.userId}`,
                  onClick: () =>
                    void act(
                      `role:${m.userId}`,
                      () =>
                        groupsService.setRole(
                          slug,
                          m.userId,
                          m.role === "moderator" ? "member" : "moderator",
                        ),
                      () =>
                        setMembers((list) =>
                          list.map((x) =>
                            x.userId === m.userId
                              ? { ...x, role: m.role === "moderator" ? "member" : "moderator" }
                              : x,
                          ),
                        ),
                    ),
                }
              : null,
        };
      }),
      empty: canRead && members.length === 0 ? copy.noMembers : null,
      more: membersMore ? { label: GROUPS_COPY.loadMore, onClick: moreMembers } : null,
    },
    requests: {
      rows: requests.map((m) => ({
        userId: m.userId,
        name: m.displayName,
        href: memberHref(m.username),
        avatarUrl: m.avatarUrl,
        since: ago(m.since) ?? "",
        approve: {
          label: copy.approve,
          busy: busy === `approve:${m.userId}`,
          onClick: () =>
            void act(
              `approve:${m.userId}`,
              () => groupsService.approve(slug, m.userId),
              () => {
                setRequests((list) => list.filter((x) => x.userId !== m.userId));
                refresh();
              },
            ),
        },
        decline: {
          label: copy.decline,
          busy: busy === `decline:${m.userId}`,
          onClick: () =>
            void act(
              `decline:${m.userId}`,
              () => groupsService.removeMember(slug, m.userId),
              () => {
                setRequests((list) => list.filter((x) => x.userId !== m.userId));
                refresh();
              },
            ),
        },
      })),
      empty: requests.length === 0 ? copy.noRequests : null,
    },
    confirm: {
      open: confirm !== null,
      message:
        confirm?.kind === "leave"
          ? copy.leaveConfirm
          : confirm?.kind === "closeDown"
            ? copy.closeDownConfirm
            : confirm?.kind === "remove"
              ? copy.removeConfirm(confirm.name)
              : "",
      confirmLabel:
        confirm?.kind === "leave"
          ? copy.leave
          : confirm?.kind === "closeDown"
            ? copy.closeDown
            : copy.remove,
      cancelLabel: GROUPS_COPY.composer.cancel,
      busy: busy !== null,
      onConfirm: runConfirm,
      onCancel: () => setConfirm(null),
    },
  };
}
