"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FEED_COPY, FEED_PHOTO_LIMIT, FEED_SUGGESTION_LIMIT } from "@/constants/feed";
import { Routes } from "@/constants/Routes";
import {
  COMMENT_BODY_MAX,
  handleOf,
  postBodyMax,
  toCommentVM,
  toPostVM,
  type CommentPM,
  type CommentVM,
  type DraftPhotoVM,
  type FeedSuggestionVM,
  type PostMediaVM,
  type FeedPM as FeedPagePM,
  type PostPM,
  type PostVM,
  type PostVisibility,
} from "@/domain/post";
import type { KinkCurrency } from "@/domain/kinkcoins";
import type { WalletSummaryPM } from "@/domain/wallet";
import type { GiftInDoubt } from "@/domain/wallet";
import { GIFT_COPY, postGiftsService } from "@/services/post-gifts.service";
import { pendingTransfersService } from "@/services/pendingTransfers.service";
import { ApiError } from "@/services/apiClient";
import { useMentionSuggestions, type MentionField } from "./useMentionSuggestions";
import {
  applyLike,
  applyRepost,
  applySave,
  applyToContent,
  applyToPost,
  canSubmitComment,
  canSubmitPost,
  postPermalink,
  postsApi,
  remainingPhotoSlots,
  toggleFollowOnSuggestion,
  toggleLikeOnPost,
  toggleRepostOnPost,
  toggleSaveOnPost,
  uploadPostPhoto,
  withCommentDelta,
  type SuggestedPersonPM,
} from "@/services/posts.service";

/** Profile link for an author; null for a member who has no username yet. */
const memberHref = (username: string | null) => (username ? Routes.member(username) : null);

interface DraftPhoto extends DraftPhotoVM {
  key: string | null;
}

export interface FeedOptions {
  /**
   * Show only this member's posts — the profile Posts tab. The API applies the
   * same visibility rule either way, so a friends-only post stays hidden from a
   * stranger browsing the profile exactly as it does in the feed.
   */
  author?: string | null;
  /** One post on its own — the permalink page. */
  postId?: string | null;
  /** The viewer's saved posts instead of the feed. */
  saved?: boolean;
  /** Search: the posts whose text contains this. */
  search?: string | null;
  /** The composer's limit (Silver writes longer posts), which a picked @mention mustn't pass. */
  postMaxLength?: number;
  /**
   * False while the author is still being resolved. /profile has to ask the API
   * who you are before it can ask for your posts, and without this the first
   * render would fetch the home feed and show somebody else's posts under your
   * own Posts tab.
   */
  ready?: boolean;
}

/**
 * The feed: reading it, writing to it, and reacting to it. Serves both the home
 * feed and a profile's Posts tab, so a post behaves the same wherever it is
 * read — one like, one comment sheet, one delete.
 *
 * Photos upload the moment they are picked rather than on submit, so the Post
 * button is instant on the connection most members are on — by the time the
 * caption is typed the bytes are usually already in the bucket.
 */
export function useFeedPresenter({
  author = null,
  postId = null,
  saved = false,
  search = null,
  postMaxLength = postBodyMax(false),
  ready = true,
}: FeedOptions = {}) {
  const router = useRouter();

  const [posts, setPosts] = useState<PostPM[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const surface = `${postId ?? ""}|${author ?? ""}|${saved}|${search ?? ""}`;
  /**
   * Each first page starts a round of the list: another list, the same list
   * switched off and on again (a search cleared and typed again), or one gone
   * back to. Until the round's first page is in, the list is loading: it can't
   * page, and a next page asked for in an earlier round is dropped. Deriving
   * `loading` from the round rather than flipping a flag means walking from
   * one member's profile to another shows a load instead of a flash of the
   * previous member's posts — the page component stays mounted across that.
   */
  const [requested, setRequested] = useState({ surface, ready, round: 1 });
  if (requested.surface !== surface || requested.ready !== ready) {
    setRequested({ surface, ready, round: requested.round + 1 });
  }
  const round = requested.round;
  const [loadedRound, setLoadedRound] = useState(0);
  const loading = !ready || loadedRound !== round;
  // The round on screen, for the next pages still out when it changes.
  const shownRound = useRef(round);
  useEffect(() => {
    shownRound.current = round;
  }, [round]);
  // The next page loading, for which round: an earlier round's never holds
  // this one up, and only the request that set it may clear it.
  const [loadingMoreFor, setLoadingMoreFor] = useState<{ round: number; ask: number } | null>(null);
  const loadingMore = !loading && loadingMoreFor?.round === round;
  const asks = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [autoPickPhoto, setAutoPickPhoto] = useState(false);
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentPM[]>([]);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  // "@" and a few letters in either box suggests members to mention.
  const {
    track: trackMention,
    picker: mentionPicker,
    close: closeMention,
  } = useMentionSuggestions(
    useCallback((field: MentionField, text: string) => {
      if (field === "post") setDraft(text);
      else setCommentDraft(text);
    }, []),
  );
  /** A box's text changed, or its caret moved: where it is decides the suggestions. */
  const typeDraft = useCallback(
    (value: string, caret?: number) => {
      setDraft(value);
      trackMention("post", value, caret ?? value.length);
    },
    [trackMention],
  );
  const typeCommentDraft = useCallback(
    (value: string, caret?: number) => {
      setCommentDraft(value);
      trackMention("comment", value, caret ?? value.length);
    },
    [trackMention],
  );
  const [commentSending, setCommentSending] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<PostMediaVM | null>(null);
  /** Brief confirmation after a share; there is nothing else to show for it. */
  const [shareNote, setShareNote] = useState<string | null>(null);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [suggestions, setSuggestions] = useState<SuggestedPersonPM[]>([]);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  const [followBusy, setFollowBusy] = useState<string[]>([]);

  /** Object URLs outlive React state, so they are revoked by hand. */
  const previewUrls = useRef<string[]>([]);

  /** Which page of which list to read — the five surfaces differ only here. */
  const loadPage = useCallback(
    async (cursor: string | null): Promise<FeedPagePM> => {
      if (postId) return { items: [await postsApi.byId(postId)], nextCursor: null };
      if (saved) return postsApi.saved(cursor);
      return postsApi.feed(cursor, undefined, author, search);
    },
    [author, postId, saved, search],
  );

  const onUnauthorized = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(Routes.login);
        return true;
      }
      return false;
    },
    [router],
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await loadPage(null);
        if (cancelled) return;
        setPosts(page.items);
        setCursor(page.nextCursor);
        setError(null);
      } catch (e) {
        if (cancelled || onUnauthorized(e)) return;
        // Nothing of the list before belongs under this one's error.
        setPosts([]);
        setCursor(null);
        setError(FEED_COPY.feedError);
      } finally {
        if (!cancelled) setLoadedRound(round);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [round, loadPage, ready, onUnauthorized]);

  useEffect(() => {
    // Only the home feed carries the suggestions strip.
    if (author || postId || saved || search || !ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await postsApi.suggested(FEED_SUGGESTION_LIMIT);
        if (!cancelled) setSuggestions(page.items);
      } catch {
        // The strip is a nicety; a failure just leaves it out.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [author, postId, saved, search, ready]);

  // Revoke every preview on unmount so a long session doesn't leak blobs.
  useEffect(
    () => () => {
      previewUrls.current.forEach((u) => URL.revokeObjectURL(u));
      previewUrls.current = [];
    },
    [],
  );

  const loadMore = useCallback(async () => {
    // Until a new list's first page is in, the cursor is still the old list's.
    if (!cursor || loadingMore || loading) return;
    const ask = ++asks.current;
    setLoadingMoreFor({ round, ask });
    try {
      const page = await loadPage(cursor);
      if (shownRound.current !== round) return;
      setPosts((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      if (shownRound.current === round && !onUnauthorized(e)) setError(FEED_COPY.feedError);
    } finally {
      setLoadingMoreFor((current) => (current?.ask === ask ? null : current));
    }
  }, [cursor, loadPage, loading, loadingMore, onUnauthorized, round]);

  const openMedia = useCallback((media: PostMediaVM) => setLightbox(media), []);
  const closeMedia = useCallback(() => setLightbox(null), []);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }, []);

  // ---- composer ---------------------------------------------------------

  const openComposer = useCallback(() => {
    setComposerError(null);
    setAutoPickPhoto(false);
    setComposerOpen(true);
  }, []);

  /** The photo button on the composer bar: open the dialog on the file picker. */
  const openComposerWithPhoto = useCallback(() => {
    setComposerError(null);
    setAutoPickPhoto(true);
    setComposerOpen(true);
  }, []);

  const discardPhotos = useCallback(() => {
    setPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      previewUrls.current = previewUrls.current.filter(
        (u) => !prev.some((p) => p.previewUrl === u),
      );
      return [];
    });
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setAutoPickPhoto(false);
    setDraft("");
    closeMention("post");
    setVisibility("public");
    setComposerError(null);
    discardPhotos();
  }, [discardPhotos, closeMention]);

  const addPhotos = useCallback(
    (files: File[]) => {
      setComposerError(null);
      const accepted: DraftPhoto[] = [];
      setPhotos((prev) => {
        const room = remainingPhotoSlots(prev.length);
        if (files.length > room) setComposerError(FEED_COPY.photoLimit);
        for (const file of files.slice(0, room)) {
          const previewUrl = URL.createObjectURL(file);
          previewUrls.current.push(previewUrl);
          const photo: DraftPhoto = {
            id: `${file.name}-${file.size}-${Date.now()}-${accepted.length}`,
            previewUrl,
            uploading: true,
            error: null,
            key: null,
          };
          accepted.push(photo);
          void (async () => {
            try {
              const key = await uploadPostPhoto(file);
              setPhotos((cur) =>
                cur.map((p) => (p.id === photo.id ? { ...p, key, uploading: false } : p)),
              );
            } catch (e) {
              if (onUnauthorized(e)) return;
              const message =
                e instanceof ApiError ? e.message : "Could not upload that photo. Try again.";
              setPhotos((cur) =>
                cur.map((p) =>
                  p.id === photo.id ? { ...p, uploading: false, error: message } : p,
                ),
              );
            }
          })();
        }
        return [...prev, ...accepted];
      });
    },
    [onUnauthorized],
  );

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) {
        URL.revokeObjectURL(gone.previewUrl);
        previewUrls.current = previewUrls.current.filter((u) => u !== gone.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const submitPost = useCallback(async () => {
    const ready = photos.filter((p) => p.key);
    if (!canSubmitPost(draft, ready.length) || posting) return;
    if (photos.some((p) => p.uploading)) {
      setComposerError("Hold on — a photo is still uploading.");
      return;
    }
    setPosting(true);
    setComposerError(null);
    try {
      const created = await postsApi.create({
        body: draft,
        visibility,
        mediaKeys: ready.map((p) => p.key as string),
      });
      setPosts((prev) => [created, ...prev]);
      closeComposer();
    } catch (e) {
      if (onUnauthorized(e)) return;
      setComposerError(
        e instanceof ApiError ? e.message : "Could not publish that post. Try again.",
      );
    } finally {
      setPosting(false);
    }
  }, [draft, photos, posting, visibility, closeComposer, onUnauthorized]);

  // ---- reactions --------------------------------------------------------

  /**
   * Optimistic reaction. The flip is applied to every row showing that post —
   * a post and a repost of it can both be on screen, and they must not disagree
   * — then the server's answer replaces the guess, or the guess is undone.
   */
  const react = useCallback(
    async <T extends { postId: string }>(
      postId: string,
      flip: (pm: PostPM) => PostPM,
      call: (on: boolean) => Promise<T>,
      reading: (pm: PostPM) => boolean,
      apply: (pm: PostPM, result: T) => PostPM,
    ) => {
      const before = posts.find((p) => p.postId === postId);
      if (!before) return;
      const was = reading(before);
      setPosts((prev) => applyToContent(prev, postId, flip));
      try {
        const result = await call(was);
        setPosts((prev) => prev.map((p) => apply(p, result)));
      } catch (e) {
        if (onUnauthorized(e)) return;
        // Put the card back the way the server still sees it.
        setPosts((prev) => applyToContent(prev, postId, flip));
      }
    },
    [posts, onUnauthorized],
  );

  const toggleLike = useCallback(
    (postId: string) =>
      react(
        postId,
        toggleLikeOnPost,
        (was) => (was ? postsApi.unlike(postId) : postsApi.like(postId)),
        (pm) => pm.likedByMe,
        applyLike,
      ),
    [react],
  );

  const toggleRepost = useCallback(
    (postId: string) =>
      react(
        postId,
        toggleRepostOnPost,
        (was) => (was ? postsApi.unrepost(postId) : postsApi.repost(postId)),
        (pm) => pm.repostedByMe,
        applyRepost,
      ),
    [react],
  );

  const toggleSave = useCallback(
    (postId: string) =>
      react(
        postId,
        toggleSaveOnPost,
        (was) => (was ? postsApi.unsave(postId) : postsApi.save(postId)),
        (pm) => pm.savedByMe,
        applySave,
      ),
    [react],
  );

  /**
   * Share hands the post's link to the system sheet where there is one, and
   * otherwise copies it. Either way the member is told what happened — a button
   * that silently does something is the same as one that does nothing.
   */
  const share = useCallback(async (postId: string) => {
    const url = postPermalink(postId);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareNote(FEED_COPY.shareCopied);
      }
      const result = await postsApi.share(postId);
      setPosts((prev) =>
        applyToContent(prev, result.postId, (p) => ({ ...p, shares: result.shares })),
      );
    } catch {
      // A cancelled share sheet lands here too, which is not worth a message.
    }
  }, []);

  const dismissShareNote = useCallback(() => setShareNote(null), []);

  // ---- comments ---------------------------------------------------------

  const openComments = useCallback(
    async (id: string) => {
      setCommentsFor(id);
      setComments([]);
      setCommentsCursor(null);
      setCommentDraft("");
      closeMention("comment");
      setCommentsError(null);
      setCommentsLoading(true);
      try {
        const page = await postsApi.comments(id);
        setComments(page.items);
        setCommentsCursor(page.nextCursor);
      } catch (e) {
        if (onUnauthorized(e)) return;
        setCommentsError("Could not load comments. Try again.");
      } finally {
        setCommentsLoading(false);
      }
    },
    [onUnauthorized, closeMention],
  );

  const closeComments = useCallback(() => {
    setCommentsFor(null);
    setComments([]);
    setCommentsCursor(null);
    setCommentDraft("");
    closeMention("comment");
    setCommentsError(null);
  }, [closeMention]);

  const loadMoreComments = useCallback(async () => {
    if (!commentsFor || !commentsCursor || commentsLoading) return;
    setCommentsLoading(true);
    try {
      const page = await postsApi.comments(commentsFor, commentsCursor);
      setComments((prev) => [...prev, ...page.items]);
      setCommentsCursor(page.nextCursor);
    } catch (e) {
      if (!onUnauthorized(e)) setCommentsError("Could not load comments. Try again.");
    } finally {
      setCommentsLoading(false);
    }
  }, [commentsFor, commentsCursor, commentsLoading, onUnauthorized]);

  const submitComment = useCallback(async () => {
    if (!commentsFor || !canSubmitComment(commentDraft) || commentSending) return;
    const postId = commentsFor;
    setCommentSending(true);
    setCommentsError(null);
    try {
      const created = await postsApi.comment(postId, commentDraft.trim());
      setComments((prev) => [created, ...prev]);
      setPosts((prev) => applyToPost(prev, postId, (p) => withCommentDelta(p, 1)));
      setCommentDraft("");
      closeMention("comment");
    } catch (e) {
      if (onUnauthorized(e)) return;
      setCommentsError(
        e instanceof ApiError ? e.message : "Could not post that comment. Try again.",
      );
    } finally {
      setCommentSending(false);
    }
  }, [commentsFor, commentDraft, commentSending, onUnauthorized, closeMention]);

  const deleteComment = useCallback(
    async (id: string) => {
      const postId = commentsFor;
      if (!postId) return;
      const snapshot = comments;
      setComments((prev) => prev.filter((c) => c.id !== id));
      setPosts((prev) => applyToPost(prev, postId, (p) => withCommentDelta(p, -1)));
      try {
        await postsApi.removeComment(id);
      } catch (e) {
        if (onUnauthorized(e)) return;
        setComments(snapshot);
        setPosts((prev) => applyToPost(prev, postId, (p) => withCommentDelta(p, 1)));
        setCommentsError("Could not delete that comment. Try again.");
      }
    },
    [comments, commentsFor, onUnauthorized],
  );

  // ---- post menu / delete ----------------------------------------------

  const openMenu = useCallback((id: string) => setMenuFor(id), []);
  const closeMenu = useCallback(() => setMenuFor(null), []);
  const askDelete = useCallback((id: string) => {
    setMenuFor(null);
    setConfirmDelete(id);
  }, []);
  const cancelDelete = useCallback(() => setConfirmDelete(null), []);

  const confirmDeletePost = useCallback(async () => {
    if (!confirmDelete || deleting) return;
    const id = confirmDelete;
    setDeleting(true);
    try {
      await postsApi.remove(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (commentsFor === id) closeComments();
      setConfirmDelete(null);
    } catch (e) {
      if (!onUnauthorized(e)) setError("Could not delete that post. Try again.");
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, deleting, commentsFor, closeComments, onUnauthorized]);

  // ---- suggestions ------------------------------------------------------

  const hideSuggestions = useCallback(() => setSuggestionsHidden(true), []);

  const toggleFollow = useCallback(
    async (userId: string) => {
      const person = suggestions.find((s) => s.userId === userId);
      if (!person?.username || followBusy.includes(userId)) return;
      const handle = person.username;
      setFollowBusy((prev) => [...prev, userId]);
      setSuggestions((prev) =>
        prev.map((s) => (s.userId === userId ? toggleFollowOnSuggestion(s) : s)),
      );
      try {
        if (person.isFollowing) await postsApi.unfollow(handle);
        else await postsApi.follow(handle);
      } catch (e) {
        if (!onUnauthorized(e)) {
          setSuggestions((prev) =>
            prev.map((s) => (s.userId === userId ? toggleFollowOnSuggestion(s) : s)),
          );
        }
      } finally {
        setFollowBusy((prev) => prev.filter((id) => id !== userId));
      }
    },
    [suggestions, followBusy, onUnauthorized],
  );

  // ---- view models ------------------------------------------------------

  const postVMs: PostVM[] = useMemo(
    () => posts.map((p) => toPostVM(p, expanded.includes(p.id), memberHref)),
    [posts, expanded],
  );

  const commentVMs: CommentVM[] = useMemo(
    () => comments.map((c) => toCommentVM(c, memberHref)),
    [comments],
  );

  const suggestionVMs: FeedSuggestionVM[] = useMemo(
    () =>
      suggestions.map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        silver: Boolean(s.silver),
        handle: handleOf(s.username),
        avatarUrl: s.avatarUrl,
        isFollowing: s.isFollowing,
        busy: followBusy.includes(s.userId),
        href: memberHref(s.username),
      })),
    [suggestions, followBusy],
  );

  const photoVMs: DraftPhotoVM[] = useMemo(
    () =>
      photos.map(({ id, previewUrl, uploading, error: e }) => ({
        id,
        previewUrl,
        uploading,
        error: e,
      })),
    [photos],
  );

  const [giftTarget, setGiftTarget] = useState<{ postId: string; name: string } | null>(null);
  const [giftCurrency, setGiftCurrency] = useState<KinkCurrency>("coin");
  const [giftQuantity, setGiftQuantity] = useState("1");
  const [giftSummary, setGiftSummary] = useState<WalletSummaryPM | null>(null);
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftSending, setGiftSending] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const giftKey = useRef("");
  const giftBusy = useRef(false);
  // A gift sent but not answered, with its sender: it's only ever sent again by them.
  const uncertainGift = useRef<(GiftInDoubt & { member: string }) | null>(null);
  const [giftLocked, setGiftLocked] = useState(false);
  const giftLoadVersion = useRef(0);
  /** A gift answered (sent or refused): no longer in doubt, here or kept. */
  const settleGift = (member: string, key: string) => {
    uncertainGift.current = null;
    pendingTransfersService.settleGift(member, key);
  };
  /**
   * Settles its sender's earlier gift in doubt by sending it again exactly as it was: the
   * server returns the gift it made, makes it once, or refuses, even if its post has gone
   * since. True once it's settled, false while it's still in doubt.
   */
  const settleEarlierGift = async (gift: GiftInDoubt & { member: string }) => {
    try {
      await postGiftsService.send(
        gift.postId,
        gift.currency,
        Number(gift.quantity),
        gift.key,
        gift.member,
      );
      setShareNote(GIFT_COPY.earlierSent);
    } catch (e) {
      if (pendingTransfersService.failure(e) !== "refused") return false;
      // Refused (its post gone before it landed, say): nothing was sent.
    }
    settleGift(gift.member, gift.key);
    return true;
  };
  /**
   * This member's gift in doubt, if any. The kept copy is the truth across tabs: another tab may
   * have settled the one this page remembers, or kept a newer one. Only when this browser keeps
   * nothing (storage off) does this page's own record count.
   */
  const giftInDoubt = (member: string): (GiftInDoubt & { member: string }) | null => {
    const kept = pendingTransfersService.gift(member);
    if (kept) return { ...kept, member };
    const own = uncertainGift.current;
    return own && own.member === member && !pendingTransfersService.canKeep() ? own : null;
  };
  const openGift = async (postId: string, currency: KinkCurrency = "coin") => {
    if (giftBusy.current) return;
    const target = posts.find((p) => p.postId === postId);
    if (!target) return;
    if (target.mine && !target.repostedBy) {
      setShareNote(GIFT_COPY.self);
      return;
    }
    const version = ++giftLoadVersion.current;
    setGiftTarget({ postId, name: target.author.displayName });
    setGiftCurrency(currency);
    setGiftQuantity("1");
    setGiftLocked(false);
    setGiftSummary(null);
    setGiftError(null);
    giftKey.current = crypto.randomUUID();
    setGiftLoading(true);
    try {
      // Whose wallet this is decides everything below: a gift in doubt is only ever sent again
      // by its sender, never under an account switched to in another tab.
      const summary = await postGiftsService.balance();
      if (version !== giftLoadVersion.current) return;
      setGiftSummary(summary);
      const member = summary.userId ?? null;
      let pending = member ? giftInDoubt(member) : null;
      // Earlier ones (for other posts) are settled first, wherever their posts are, so none can
      // be sent twice or hold this one up. Each settled, it's checked again: another tab may
      // have kept a newer one meanwhile.
      let settledAny = false;
      for (let rounds = 0; pending && pending.postId !== postId && rounds < 3; rounds++) {
        giftBusy.current = true;
        const earlier: GiftInDoubt & { member: string } = pending;
        const settled = await settleEarlierGift(earlier).finally(() => {
          giftBusy.current = false;
        });
        if (version !== giftLoadVersion.current) return;
        if (!settled) break;
        settledAny = true;
        pending = member ? giftInDoubt(member) : null;
      }
      if (pending && pending.postId !== postId) {
        uncertainGift.current = pending;
        setGiftTarget(null);
        setShareNote(GIFT_COPY.earlierUnconfirmed);
        return;
      }
      uncertainGift.current = pending;
      if (settledAny) {
        // One may have just been sent: read the balance again before offering this one.
        const after = await postGiftsService.balance();
        if (version !== giftLoadVersion.current) return;
        setGiftSummary(after);
      }
      if (pending) {
        uncertainGift.current = pending;
        setGiftCurrency(pending.currency);
        setGiftQuantity(pending.quantity);
        setGiftLocked(true);
        giftKey.current = pending.key;
      }
      if (!summary.settings.enabled) setGiftError(GIFT_COPY.unavailable);
    } catch (e) {
      // Without the wallet there's no telling whose it is: nothing is offered to send.
      if (version === giftLoadVersion.current)
        setGiftError(e instanceof Error ? e.message : "Could not load your wallet.");
    } finally {
      if (version === giftLoadVersion.current) setGiftLoading(false);
    }
  };
  const sendGift = async () => {
    const quote = postGiftsService.quote(giftSummary, giftCurrency, giftQuantity);
    const member = giftSummary?.userId;
    // A gift is only sent knowing whose wallet it comes from.
    if (giftBusy.current || !giftTarget || !member || (!giftLocked && !quote.valid)) return;
    const wasInDoubt = uncertainGift.current !== null;
    const kept = pendingTransfersService.gift(member);
    if (kept && kept.key !== giftKey.current) {
      setGiftError(GIFT_COPY.earlierUnconfirmed);
      return;
    }
    giftBusy.current = true;
    setGiftSending(true);
    setGiftError(null);
    const gift = {
      postId: giftTarget.postId,
      currency: giftCurrency,
      quantity: giftQuantity,
      key: giftKey.current,
    };
    // Kept before it's sent: if the page goes before the answer comes, a retry reuses its key.
    uncertainGift.current = { ...gift, member };
    pendingTransfersService.keepGift(member, gift);
    try {
      await postGiftsService.send(gift.postId, gift.currency, quote.quantity, gift.key, member);
      settleGift(member, gift.key);
      setGiftLocked(false);
      setShareNote(postGiftsService.sentLabel(giftQuantity, giftCurrency, giftTarget.name));
      setGiftTarget(null);
      // Read the committed count so a retried, idempotent gift never counts twice.
      const updated = await postsApi.byId(giftTarget.postId).catch(() => null);
      if (updated)
        setPosts((prev) =>
          applyToContent(prev, updated.postId, (p) => ({ ...p, gifts: updated.gifts ?? 0 })),
        );
    } catch (e) {
      const failure = pendingTransfersService.failure(e);
      const message = e instanceof Error ? e.message : "Please try again.";
      if (failure === "refused" || (failure === "unread" && !wasInDoubt)) {
        // Answered (or this first send never read): nothing was sent.
        settleGift(member, gift.key);
        setGiftLocked(false);
        setGiftError(message);
      } else if (failure === "unread") {
        // Says nothing about the earlier send: still in doubt, key and all.
        setGiftLocked(true);
        setGiftError(message);
      } else {
        setGiftLocked(true);
        setGiftError(
          "Delivery could not be confirmed. Retry this same gift to check it safely, or check Transaction History.",
        );
      }
    } finally {
      giftBusy.current = false;
      setGiftSending(false);
    }
  };
  const giftQuote = postGiftsService.quote(giftSummary, giftCurrency, giftQuantity);
  const giftDialog = {
    open: giftTarget !== null,
    recipient: giftTarget?.name ?? "",
    currency: giftCurrency,
    quantity: giftQuantity,
    copy: GIFT_COPY,
    buyHref: Routes.kinkcoinsBuy,
    availableLabel: postGiftsService.availableLabel(giftQuote.available, giftCurrency),
    confirmLabel: postGiftsService.confirmLabel(giftQuantity, giftCurrency, giftTarget?.name ?? ""),
    loading: giftLoading,
    locked: giftLocked,
    sending: giftSending,
    error: giftError,
    canSend: (giftQuote.valid || giftLocked) && !giftLoading && !giftSending,
    onCurrency: (v: KinkCurrency) => {
      if (!giftBusy.current && !giftLocked && v !== giftCurrency) {
        setGiftCurrency(v);
        giftKey.current = crypto.randomUUID();
        setGiftError(null);
      }
    },
    onQuantity: (v: string) => {
      if (!giftBusy.current && !giftLocked && v !== giftQuantity) {
        setGiftQuantity(v);
        giftKey.current = crypto.randomUUID();
        setGiftError(null);
      }
    },
    onSend: sendGift,
    onClose: () => {
      if (!giftBusy.current) {
        giftLoadVersion.current++;
        setGiftTarget(null);
      }
    },
  };

  return {
    openGift,
    giftDialog,
    loading,
    error,
    posts: postVMs,
    hasMore: !loading && Boolean(cursor),
    loadingMore,
    loadMore,
    toggleExpanded,
    lightbox,
    openMedia,
    closeMedia,

    composerOpen,
    autoPickPhoto,
    openComposer,
    openComposerWithPhoto,
    closeComposer,
    draft,
    setDraft: typeDraft,
    postMentions: mentionPicker("post", postMaxLength),
    visibility,
    setVisibility,
    photos: photoVMs,
    photoSlots: remainingPhotoSlots(photos.length),
    photoLimit: FEED_PHOTO_LIMIT,
    addPhotos,
    removePhoto,
    posting,
    composerError,
    canPost: canSubmitPost(draft, photos.filter((p) => p.key).length) && !posting,
    submitPost,

    toggleLike,
    toggleRepost,
    toggleSave,
    share,
    shareNote,
    dismissShareNote,

    commentsFor,
    comments: commentVMs,
    commentsLoading,
    commentsError,
    commentsHasMore: Boolean(commentsCursor),
    loadMoreComments,
    openComments,
    closeComments,
    commentDraft,
    setCommentDraft: typeCommentDraft,
    commentMentions: mentionPicker("comment", COMMENT_BODY_MAX),
    commentSending,
    canComment: canSubmitComment(commentDraft) && !commentSending,
    submitComment,
    deleteComment,

    menuFor,
    openMenu,
    closeMenu,
    askDelete,
    confirmDelete,
    /** The row waiting on a confirm is a repost, so the wording must say so. */
    confirmDeleteIsRepost: posts.some((p) => p.id === confirmDelete && p.id !== p.postId),
    cancelDelete,
    confirmDeletePost,
    deleting,

    suggestions: suggestionsHidden ? [] : suggestionVMs,
    suggestionsHidden,
    hideSuggestions,
    toggleFollow,
  };
}

export type FeedVM = ReturnType<typeof useFeedPresenter>;
