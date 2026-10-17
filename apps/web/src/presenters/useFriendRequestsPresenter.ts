"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FRIENDSHIP_COPY } from "@/constants/friendship";
import { Routes } from "@/constants/Routes";
import type { FriendRequestPM, FriendshipAction } from "@/domain/friendship";
import { friendshipService } from "@/services/friendship.service";

export function useFriendRequestsPresenter(ready = true) {
  const [direction, setDirection] = useState<"incoming" | "outgoing">("incoming");
  const [items, setItems] = useState<FriendRequestPM[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const current = ++generation.current;
    void friendshipService
      .requests(direction, 1)
      .then((res) => {
        if (generation.current !== current) return;
        setItems(res.items);
        setHasMore(res.hasMore);
      })
      .catch(() => {
        if (generation.current === current) setError(FRIENDSHIP_COPY.error);
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
    return () => {
      generation.current = current + 1;
    };
  }, [ready, direction, revision]);

  const act = useCallback(
    async (id: string, action: FriendshipAction) => {
      const request = items.find((item) => item.id === id);
      if (!request?.username || busy) return;
      const current = generation.current;
      setBusy(id);
      setError(null);
      try {
        await friendshipService.change(request.username, action);
        if (generation.current === current) {
          setItems([]);
          setPage(1);
          setHasMore(false);
          setLoading(true);
          setRevision((previous) => previous + 1);
        }
      } catch {
        if (generation.current === current) setError(FRIENDSHIP_COPY.error);
      } finally {
        setBusy(null);
      }
    },
    [items, busy],
  );

  const more = async () => {
    if (loading || !hasMore) return;
    const current = generation.current;
    setLoading(true);
    try {
      const res = await friendshipService.requests(direction, page + 1);
      if (generation.current !== current) return;
      setItems((previous) => [
        ...previous,
        ...res.items.filter((item) => !previous.some((old) => old.id === item.id)),
      ]);
      setPage((previous) => previous + 1);
      setHasMore(res.hasMore);
    } catch {
      if (generation.current === current) setError(FRIENDSHIP_COPY.error);
    } finally {
      if (generation.current === current) setLoading(false);
    }
  };

  return {
    copy: FRIENDSHIP_COPY,
    direction,
    setDirection: (next: "incoming" | "outgoing") => {
      if (next === direction) return;
      setDirection(next);
      setItems([]);
      setLoading(true);
      setError(null);
      setPage(1);
      setHasMore(false);
    },
    loading,
    error,
    hasMore,
    more,
    retry: () => {
      setItems([]);
      setLoading(true);
      setError(null);
      setPage(1);
      setHasMore(false);
      setRevision((previous) => previous + 1);
    },
    items: items.map((item) => ({
      id: item.id,
      name: item.displayName,
      avatarUrl: item.avatarUrl,
      href: item.username ? Routes.member(item.username) : null,
      disabled: busy !== null || !item.username,
      primaryLabel: direction === "incoming" ? FRIENDSHIP_COPY.accept : FRIENDSHIP_COPY.cancel,
      secondaryLabel: direction === "incoming" ? FRIENDSHIP_COPY.decline : null,
      onPrimary: () => void act(item.id, direction === "incoming" ? "accept" : "dismiss"),
      onSecondary: () => void act(item.id, "dismiss"),
    })),
  };
}
