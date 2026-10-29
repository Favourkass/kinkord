import { useEffect, useRef, useState } from "react";
import { SHARE_COPY } from "@/constants/sharing";
import type { ExternalShare, ShareFriendPM, ShareMode } from "@/domain/sharing";
import { sharingService } from "@/services/sharing.service";
import { profileApi } from "@/services/profile.service";
import type { OwnProfilePM } from "@/domain/profile";
import { ApiError } from "@/services/apiClient";

export function usePostSharePresenter(
  onShared: (result: { postId: string; shares: number } | null, message: string) => void,
) {
  const [postId, setPostId] = useState<string | null>(null);
  const [mode, setMode] = useState<ShareMode>("choices");
  const [caption, setCaption] = useState("");
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<ShareFriendPM[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OwnProfilePM | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!postId) return;
    let active = true;
    void profileApi
      .own()
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [postId]);
  const attempt = useRef(new Map<string, string>());
  useEffect(() => {
    if (!postId) return;
    let active = true;
    // Re-run on a mode change too: switching mode shows the loading state until this settles.
    const timer = setTimeout(() => {
      void sharingService
        .friends(query)
        .then((rows) => {
          if (active) setFriends(rows);
        })
        .catch(() => {
          if (active) setError("Could not load sharing destinations. Please try again.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [postId, mode, query]);
  function open(id: string) {
    if (lock.current) return;
    setPostId(id);
    setMode("choices");
    setLoading(true);
    setCaption("");
    setQuery("");
    setError(null);
    setFriends([]);
    attempt.current.clear();
  }
  function close() {
    if (!lock.current) setPostId(null);
  }
  async function perform(action: "feed" | "friend" | ExternalShare, destination?: string) {
    if (!postId || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      let result: { postId: string; shares: number } | null;
      if (action === "feed") result = await sharingService.feed(postId, caption);
      else if (action === "friend") {
        const key = `${destination}:${caption}`;
        const clientId = attempt.current.get(key) ?? crypto.randomUUID();
        attempt.current.set(key, clientId);
        result = await sharingService.friend(destination!, postId, caption, clientId);
      } else result = await sharingService.external(action, postId, caption);
      onShared(
        result,
        action === "copy"
          ? SHARE_COPY.copied
          : action === "whatsapp" || action === "twitter"
            ? SHARE_COPY.opened
            : SHARE_COPY.sent,
      );
      setPostId(null);
    } catch (e) {
      if (!(typeof e === "object" && e !== null && "name" in e && e.name === "AbortError"))
        setError(e instanceof ApiError || e instanceof Error ? e.message : SHARE_COPY.error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    open,
    dialog: {
      open: postId !== null,
      mode,
      caption,
      query,
      loading,
      busy,
      error,
      copy: SHARE_COPY,
      viewer: {
        name: profile?.displayName || "Your profile",
        avatarUrl: profile?.avatarUrl ?? null,
      },
      friends: friends.map((p) => ({
        id: p.userId,
        name: p.displayName ?? p.username ?? "Member",
        initial: (p.displayName ?? p.username ?? "M").slice(0, 1).toUpperCase(),
      })),
      onClose: close,
      onMode: (m: ShareMode) => {
        setMode(m);
        setLoading(true);
        setError(null);
      },
      onCaption: setCaption,
      onQuery: (value: string) => {
        setLoading(true);
        setQuery(value);
      },
      onFeed: () => void perform("feed"),
      onFriend: (id: string) => void perform("friend", id),
      onExternal: (target: ExternalShare) => void perform(target),
    },
  };
}
