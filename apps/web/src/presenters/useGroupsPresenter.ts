import { useCallback, useEffect, useRef, useState } from "react";
import { Routes } from "@/constants/Routes";
import type { GroupFeedPM, GroupPM, ShareFriendPM } from "@/domain/sharing";
import { groupsService } from "@/services/sharing.service";

export function useGroupsPresenter(groupId?: string) {
  const [groups, setGroups] = useState<GroupPM[]>([]);
  const [feed, setFeed] = useState<GroupFeedPM | null>(null);
  const [friends, setFriends] = useState<ShareFriendPM[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    const rows = await groupsService.list();
    setGroups(rows);
    if (groupId) setFeed(await groupsService.feed(groupId));
  }, [groupId]);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      groupsService.list(),
      groupId ? groupsService.feed(groupId) : Promise.resolve(null),
    ])
      .then(([rows, data]) => {
        if (alive) {
          setGroups(rows);
          setFeed(data);
          setError(null);
        }
      })
      .catch(() => {
        if (alive) setError("Could not load groups. Please sign in and try again.");
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
          setLoadedId(groupId);
        }
      });
    return () => {
      alive = false;
    };
  }, [groupId]);
  useEffect(() => {
    if (!creating) return;
    let alive = true;
    const timer = setTimeout(() => {
      void groupsService
        .friends(query)
        .then((rows) => {
          if (alive) setFriends(rows);
        })
        .catch(() => {
          if (alive) setError("Could not load friends.");
        });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [creating, query]);
  async function run(work: () => Promise<unknown>, message?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      if (message) setNotice(message);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    heading: feed?.group.name ?? "Groups",
    homeHref: Routes.home,
    groupsHref: Routes.groups,
    loading: loading || loadedId !== groupId,
    busy,
    error,
    notice,
    creating,
    name,
    query,
    selectedCount: selected.length,
    groups: groups.map((g) => ({ ...g, href: Routes.group(g.id) })),
    friends: friends.map((p) => ({
      id: p.userId,
      name: p.displayName ?? p.username ?? "Member",
      selected: selected.includes(p.userId),
    })),
    detail: groupId
      ? {
          isOwner: Boolean(feed?.group.isOwner),
          members: (feed?.members ?? []).map((member) => ({
            ...member,
            name: member.name ?? "Member",
          })),
          name: feed?.group.name ?? "Group",
          items: (feed?.items ?? []).map((item) => ({
            id: item.id,
            caption: item.caption,
            sharedBy: item.sharedBy,
            canRemove: item.canRemove,
            authorName: item.post.author.displayName,
            body: item.post.body,
            imageUrl: item.post.media[0]?.thumbUrl ?? null,
            href: Routes.post(item.post.postId),
          })),
          hasMore: Boolean(feed?.nextPage),
        }
      : null,
    onCreateToggle: () => {
      setCreating((v) => !v);
      setError(null);
    },
    onName: setName,
    onQuery: setQuery,
    onSelect: (id: string) =>
      setSelected((current) =>
        current.includes(id)
          ? current.filter((v) => v !== id)
          : current.length < 50
            ? [...current, id]
            : current,
      ),
    onCreate: () =>
      void run(
        async () => {
          if (groupId) await groupsService.invite(groupId, selected);
          else await groupsService.create(name.trim(), selected);
          setCreating(false);
          setName("");
          setSelected([]);
        },
        groupId
          ? "Invitations sent."
          : "Group created. Invited friends can accept from their Groups page.",
      ),
    onRemoveMember: (id: string) => {
      if (groupId && window.confirm("Remove this member or invitation?"))
        void run(() => groupsService.removeMember(groupId, id));
    },
    onAccept: (id: string) => void run(() => groupsService.accept(id), "You joined the group."),
    onDecline: (id: string) => void run(() => groupsService.leave(id), "Invitation declined."),
    onLeave: () => {
      if (groupId && window.confirm("Leave this group?"))
        void groupsService
          .leave(groupId)
          .then(() => window.location.assign(Routes.groups))
          .catch((e) => setError(e.message));
    },
    onDelete: () => {
      if (
        groupId &&
        window.confirm("Delete this group and all its shared posts? Original posts will remain.")
      )
        void groupsService
          .remove(groupId)
          .then(() => window.location.assign(Routes.groups))
          .catch((e) => setError(e.message));
    },
    onRemovePost: (id: string) => {
      if (groupId && window.confirm("Remove this shared post from the group?"))
        void run(() => groupsService.removePost(groupId, id));
    },
    onMore: () => {
      if (groupId && feed?.nextPage && !lock.current) {
        lock.current = true;
        setBusy(true);
        void groupsService
          .feed(groupId, feed.nextPage)
          .then((next) =>
            setFeed((current) =>
              current
                ? {
                    ...next,
                    items: [
                      ...current.items,
                      ...next.items.filter((p) => !current.items.some((old) => old.id === p.id)),
                    ],
                  }
                : next,
            ),
          )
          .catch(() => setError("Could not load more posts."))
          .finally(() => {
            lock.current = false;
            setBusy(false);
          });
      }
    },
  };
}
