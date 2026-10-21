"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FEED_EDITOR, FEED_COPY, FEED_PHOTO_LIMIT, FEED_SUGGESTION_LIMIT } from "@/constants/feed";
import { Routes } from "@/constants/Routes";
import {
  COMMENT_BODY_MAX,
  FEED_TABS,
  postBodyMax,
  toCommentVM,
  toFeedSuggestionVM,
  toPostVM,
  type CommentPM,
  type CommentVM,
  type DraftPhotoVM,
  type FeedEmptyVM,
  type FeedHint,
  type FeedSuggestionPM,
  type FeedSuggestionVM,
  type PostMediaVM,
  type FeedPM as FeedPagePM,
  type FeedTab,
  type FeedTabVM,
  type PostPM,
  type PostVM,
  type PostVisibility,
  type SuggestionSegmentVM,
  type SuggestionShow,
} from "@/domain/post";
import {
  formattedBodyParts,
  type PostTextFormat,
  type DraftEdit,
  type DraftSelection,
} from "@/domain/text-format";
import { formatPostDraft, insertPostText } from "@/services/post-editor.service";
import type { KinkCurrency } from "@/domain/kinkcoins";
import type { WalletSummaryPM } from "@/domain/wallet";
import type { GiftInDoubt } from "@/domain/wallet";
import { GIFT_COPY, postGiftsService } from "@/services/post-gifts.service";
import { pendingTransfersService } from "@/services/pendingTransfers.service";
import { ApiError } from "@/services/apiClient";
import { isOfficialOrganization } from "@/services/organization-placeholder.service";
import { useMentionSuggestions, type MentionField } from "./useMentionSuggestions";
import {
  appendNewRows,
  applyLike,
  applyRepost,
  applySave,
  applyToContent,
  applyToPost,
  canSubmitComment,
  canSubmitPost,
  feedTabMemory,
  postPermalink,
  postsApi,
  remainingPhotoSlots,
  toggleLikeOnPost,
  toggleRepostOnPost,
  toggleSaveOnPost,
  uploadPostPhoto,
  withAuthorFollow,
  withCommentDelta,
  withSuggestionFollow,
  withSuggestionRestored,
  withTagsLeft,
} from "@/services/posts.service";
import { useTagPicker } from "./useTagPicker";

/** Profile link for an author; null for a member who has no username yet. */
const memberHref = (username: string | null) => (username ? Routes.member(username) : null);

/** For useSyncExternalStore: nothing but this page changes the remembered tab. */
const noOutsideChanges = () => () => {};
/** The server has no session to remember a tab from: the client reads it before the feed loads. */
const noTabOnTheServer = () => null;

/** What an empty home feed says for each tab, and the way to fill it when there is one. */
function emptyFeed(tab: FeedTab | null, hint: FeedHint | null): FeedEmptyVM {
  if (tab === "following") {
    return hint === "no_follows"
      ? {
          title: FEED_COPY.noFollowsTitle,
          body: FEED_COPY.noFollowsBody,
          action: { label: FEED_COPY.noFollowsAction, href: Routes.members },
        }
      : { title: FEED_COPY.followingEmpty, body: null, action: null };
  }
  if (tab === "nearby") {
    return hint === "no_location"
      ? {
          title: FEED_COPY.noLocationTitle,
          body: FEED_COPY.noLocationBody,
          action: { label: FEED_COPY.noLocationAction, href: Routes.profileEditLocation },
        }
      : { title: FEED_COPY.nearbyEmpty, body: null, action: null };
  }
  return { title: FEED_COPY.feedEmptyTitle, body: FEED_COPY.feedEmptyBody, action: null };
}

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
  /** Show only the posts that tag this member — the profile Tagged tab. */
  tagged?: string | null;
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
 * read — one like, one comment sheet, one delete. Only the home feed has the
 * For You | Following | Nearby tabs, remembered for the browser session.
 *
 * Photos upload the moment they are picked rather than on submit, so the Post
 * button is instant on the connection most members are on — by the time the
 * caption is typed the bytes are usually already in the bucket.
 */
export function useFeedPresenter({
  author = null,
  tagged = null,
  postId = null,
  saved = false,
  search = null,
  postMaxLength = postBodyMax(false),
  ready = true,
}: FeedOptions = {}) {
  const router = useRouter();

  // The home feed's tab: the one picked here, else the one this browser
  // session last showed. Read on the client only, and the feed waits for it,
  // so a remembered Following never loads For You first.
  const home = !author && !tagged && !postId && !saved && !search;
  const rememberedTab = useSyncExternalStore(
    noOutsideChanges,
    feedTabMemory.read,
    noTabOnTheServer,
  );
  const [pickedTab, setPickedTab] = useState<FeedTab | null>(null);
  const tab = home ? (pickedTab ?? rememberedTab) : null;
  const listReady = ready && (!home || tab !== null);

  const [posts, setPosts] = useState<PostPM[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  /** Why the list may be empty, as its first page said. */
  const [hint, setHint] = useState<FeedHint | null>(null);
  const surface = `${postId ?? ""}|${author ?? ""}|${tagged ?? ""}|${saved}|${search ?? ""}|${tab ?? ""}`;
  /**
   * Each first page starts a round of the list: another list, the same list
   * switched off and on again (a search cleared and typed again), or one gone
   * back to. Until the round's first page is in, the list is loading: it can't
   * page, and a next page asked for in an earlier round is dropped. Deriving
   * `loading` from the round rather than flipping a flag means walking from
   * one member's profile to another shows a load instead of a flash of the
   * previous member's posts — the page component stays mounted across that.
   * A home feed tab is a list of its own: switching tabs starts a round too.
   */
  const [requested, setRequested] = useState({ surface, ready: listReady, round: 1 });
  if (requested.surface !== surface || requested.ready !== listReady) {
    setRequested({ surface, ready: listReady, round: requested.round + 1 });
  }
  const round = requested.round;
  const [loadedRound, setLoadedRound] = useState(0);
  const loading = !listReady || loadedRound !== round;
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
  const tagPicker = useTagPicker(composerOpen);
  const resetTags = tagPicker.reset;

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
  const [draftSelection, setDraftSelection] = useState<
    (DraftSelection & { revision: number }) | null
  >(null);
  const applyDraftEdit = useCallback(
    (edit: DraftEdit | null) => {
      if (!edit) {
        setComposerError(FEED_EDITOR.labels.limit);
        return;
      }
      setComposerError(null);
      typeDraft(edit.text, edit.selection.end);
      setDraftSelection((previous) => ({
        ...edit.selection,
        revision: (previous?.revision ?? 0) + 1,
      }));
    },
    [typeDraft],
  );
  const formatDraft = useCallback(
    (format: PostTextFormat, selection: DraftSelection) => {
      applyDraftEdit(formatPostDraft(draft, selection, format, postMaxLength));
    },
    [applyDraftEdit, draft, postMaxLength],
  );
  const insertDraft = useCallback(
    (value: string, selection: DraftSelection) => {
      applyDraftEdit(insertPostText(draft, selection, value, postMaxLength));
    },
    [applyDraftEdit, draft, postMaxLength],
  );
  const draftPreviewParts = useMemo(() => formattedBodyParts(draft, [], () => ""), [draft]);

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

  // "Kinksters Near You". The segment asked for (null: the member's default,
  // which the API knows), then the segment shown and those offered, as the
  // API last answered.
  const [suggestions, setSuggestions] = useState<FeedSuggestionPM[]>([]);
  const [suggestionsAsked, setSuggestionsAsked] = useState<SuggestionShow | null>(null);
  const [suggestionShow, setSuggestionShow] = useState<SuggestionShow | null>(null);
  const [suggestionOptions, setSuggestionOptions] = useState<SuggestionShow[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  /** Bumped whenever another segment replaces the list, so a late failure can't reach the new one. */
  const suggestionsRound = useRef(0);
  const [followBusy, setFollowBusy] = useState<string[]>([]);

  /** Object URLs outlive React state, so they are revoked by hand. */
  const previewUrls = useRef<string[]>([]);

  /** Which page of which list to read — the surfaces differ only here. */
  const loadPage = useCallback(
    async (cursor: string | null): Promise<FeedPagePM> => {
      if (postId) return { items: [await postsApi.byId(postId)], nextCursor: null };
      if (saved) return postsApi.saved(cursor);
      if (tab) return postsApi.feed(cursor, undefined, null, null, tab);
      if (tagged) return postsApi.feed(cursor, undefined, null, null, null, tagged);
      return postsApi.feed(cursor, undefined, author, search);
    },
    [author, tagged, postId, saved, search, tab],
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
    if (!listReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await loadPage(null);
        if (cancelled) return;
        setPosts(page.items);
        setCursor(page.nextCursor);
        setHint(page.hint ?? null);
        setError(null);
      } catch (e) {
        if (cancelled || onUnauthorized(e)) return;
        // Nothing of the list before belongs under this one's error.
        setPosts([]);
        setCursor(null);
        setHint(null);
        setError(FEED_COPY.feedError);
      } finally {
        if (!cancelled) setLoadedRound(round);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [round, loadPage, listReady, onUnauthorized]);

  useEffect(() => {
    // Only the home feed carries the suggestions strip.
    if (author || tagged || postId || saved || search || !ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await postsApi.suggested(FEED_SUGGESTION_LIMIT, suggestionsAsked);
        if (cancelled) return;
        setSuggestions(page.items);
        setSuggestionShow(page.show ?? null);
        setSuggestionOptions(page.options ?? []);
      } catch {
        // The strip is a nicety; a failure just leaves it out.
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [author, tagged, postId, saved, search, ready, suggestionsAsked]);

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
      setPosts((prev) => appendNewRows(prev, page.items));
      setCursor(page.nextCursor);
    } catch (e) {
      if (shownRound.current === round && !onUnauthorized(e)) setError(FEED_COPY.feedError);
    } finally {
      setLoadingMoreFor((current) => (current?.ask === ask ? null : current));
    }
  }, [cursor, loadPage, loading, loadingMore, onUnauthorized, round]);

  /**
   * Another tab: its list replaces this one, from its first page. A response
   * still on its way for the tab left is dropped (the round has moved on).
   */
  const selectTab = useCallback(
    (next: FeedTab) => {
      if (!home || next === tab) return;
      feedTabMemory.remember(next);
      setPickedTab(next);
      setPosts([]);
      setCursor(null);
      setHint(null);
      setMenuFor(null);
    },
    [home, tab],
  );

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
    resetTags();
  }, [discardPhotos, closeMention, resetTags]);

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
        tags: tagPicker.usernames,
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
  }, [draft, photos, posting, visibility, tagPicker.usernames, closeComposer, onUnauthorized]);

  /** The viewer takes their tag off a post: every row showing it updates at once. */
  const removeTag = useCallback(
    async (postId: string) => {
      setMenuFor(null);
      try {
        const left = await postsApi.removeTag(postId);
        setPosts((prev) => prev.map((p) => withTagsLeft(p, left)));
      } catch (e) {
        onUnauthorized(e);
      }
    },
    [onUnauthorized],
  );

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

  // ---- following --------------------------------------------------------

  /** A segment of the toggle: its list replaces this one, and is asked for. */
  const showSuggestions = useCallback(
    (show: SuggestionShow) => {
      if (show === suggestionShow) return;
      suggestionsRound.current += 1;
      setSuggestionsAsked(show);
      setSuggestionShow(show);
      setSuggestions([]);
      setSuggestionsLoading(true);
    },
    [suggestionShow],
  );

  /**
   * Remove: the card goes at once, and the member is never suggested again. If
   * the API refuses, the card comes back where it was — unless another segment
   * has replaced the list meanwhile.
   */
  const removeSuggestion = useCallback(
    async (userId: string) => {
      const index = suggestions.findIndex((s) => s.userId === userId);
      if (index < 0) return;
      const person = suggestions[index];
      const round = suggestionsRound.current;
      setSuggestions((prev) => prev.filter((s) => s.userId !== userId));
      try {
        await postsApi.dismissSuggestion(userId);
      } catch (e) {
        if (onUnauthorized(e) || suggestionsRound.current !== round) return;
        setSuggestions((prev) => withSuggestionRestored(prev, person, index));
      }
    },
    [suggestions, onUnauthorized],
  );

  /**
   * Optimistic follow, from a suggestion card or the Follow button on the
   * official organization's posts. The posts carry whether the viewer follows
   * their author, so nothing is asked for first; the flip reaches the card and
   * every one of the member's posts at once, and is undone if the API refuses.
   */
  const toggleFollow = useCallback(
    async (userId: string) => {
      const person = suggestions.find((s) => s.userId === userId);
      const author = posts.find((p) => p.author.userId === userId)?.author;
      const handle = person?.username ?? author?.username;
      if (!handle || followBusy.includes(userId)) return;
      const was = person?.isFollowing ?? Boolean(author?.isFollowing);
      const show = (following: boolean) => {
        setSuggestions((prev) => withSuggestionFollow(prev, userId, following));
        setPosts((prev) => withAuthorFollow(prev, userId, following));
      };
      setFollowBusy((prev) => [...prev, userId]);
      show(!was);
      try {
        if (was) await postsApi.unfollow(handle);
        else await postsApi.follow(handle);
      } catch (e) {
        if (!onUnauthorized(e)) show(was);
      } finally {
        setFollowBusy((prev) => prev.filter((id) => id !== userId));
      }
    },
    [suggestions, posts, followBusy, onUnauthorized],
  );

  // ---- view models ------------------------------------------------------

  const postVMs: PostVM[] = useMemo(
    () =>
      posts.map((p) => ({
        ...toPostVM(
          p,
          expanded.includes(p.id),
          memberHref,
          new Date(),
          isOfficialOrganization(p.author.userId),
        ),
        authorFollowBusy: followBusy.includes(p.author.userId),
      })),
    [posts, expanded, followBusy],
  );

  const commentVMs: CommentVM[] = useMemo(
    () =>
      comments.map((c) =>
        toCommentVM(c, memberHref, new Date(), isOfficialOrganization(c.author.userId)),
      ),
    [comments],
  );

  const suggestionVMs: FeedSuggestionVM[] = useMemo(
    () =>
      suggestions.map((s) =>
        toFeedSuggestionVM(
          s,
          memberHref,
          followBusy.includes(s.userId),
          isOfficialOrganization(s.userId),
        ),
      ),
    [suggestions, followBusy],
  );

  // Until the client has read the remembered tab (the server render), none is
  // selected: better than showing For You for a frame and then another tab.
  const tabs: FeedTabVM[] = useMemo(
    () =>
      home
        ? FEED_TABS.map((value) => ({
            value,
            label: FEED_COPY.tabs[value],
            selected: value === tab,
          }))
        : [],
    [home, tab],
  );

  const empty = useMemo(() => emptyFeed(tab, hint), [tab, hint]);

  const suggestionSegments: SuggestionSegmentVM[] = useMemo(
    () =>
      suggestionOptions.map((value) => ({
        value,
        label: FEED_COPY.peopleShow[value],
        selected: value === suggestionShow,
      })),
    [suggestionOptions, suggestionShow],
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
  // A gift sent but not answered: its sender (it's only ever sent again as them), and whether
  // this browser could keep it (storage can be off, or full).
  type InDoubt = GiftInDoubt & { member: string; persisted: boolean };
  const uncertainGift = useRef<InDoubt | null>(null);
  const [giftLocked, setGiftLocked] = useState(false);
  const giftLoadVersion = useRef(0);
  /** A gift answered (sent or refused): no longer in doubt, here or kept. */
  const settleGift = (member: string, key: string) => {
    if (uncertainGift.current?.key === key) uncertainGift.current = null;
    pendingTransfersService.settleGift(member, key);
  };
  /**
   * This member's gifts in doubt: those kept in this browser, any tab's (the truth across tabs:
   * another may have settled this page's one, or kept others), and this page's own when it
   * couldn't be kept.
   */
  const giftsInDoubt = (member: string): InDoubt[] => {
    const own = uncertainGift.current?.member === member ? uncertainGift.current : null;
    const stored = pendingTransfersService.gifts(member);
    // Storage can't be read: no telling what's kept, so this page's own still counts.
    if (stored === null) return own ? [own] : [];
    const kept = stored.map((gift) => ({ ...gift, member, persisted: true }));
    if (own && !own.persisted && !kept.some((g) => g.key === own.key)) kept.push(own);
    return kept;
  };
  /**
   * Settles an earlier gift in doubt by sending it again exactly as it was, as its sender: the
   * server returns the gift it made, makes it once, or refuses, even if its post has gone since.
   * True once it's settled, false while it's still in doubt.
   */
  const settleEarlierGift = (gift: InDoubt) =>
    pendingTransfersService.exclusive(gift.member, async () => {
      // Another tab may have answered it while this one waited for the lock.
      if (!giftsInDoubt(gift.member).some((g) => g.key === gift.key)) {
        if (uncertainGift.current?.key === gift.key) uncertainGift.current = null;
        return true;
      }
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
    });
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
      // as its sender, never under an account switched to in another tab.
      const summary = await postGiftsService.balance();
      if (version !== giftLoadVersion.current) return;
      setGiftSummary(summary);
      const member = summary.userId ?? null;
      let doubts = member ? giftsInDoubt(member) : [];
      // All but one for this post are settled first, wherever their posts are, so none can be
      // sent twice or hold this one up; checked again after each (another tab may keep more).
      const extra = (list: InDoubt[]) =>
        list.find((g) => g.postId !== postId) ?? list.filter((g) => g.postId === postId)[1];
      let settledAny = false;
      for (let rounds = 0; member && extra(doubts) && rounds < 5; rounds++) {
        const earlier = extra(doubts) as InDoubt;
        giftBusy.current = true;
        const settled = await settleEarlierGift(earlier).finally(() => {
          giftBusy.current = false;
        });
        if (version !== giftLoadVersion.current) return;
        if (!settled) break;
        settledAny = true;
        doubts = giftsInDoubt(member);
      }
      if (extra(doubts)) {
        uncertainGift.current = extra(doubts) ?? null;
        setGiftTarget(null);
        setShareNote(GIFT_COPY.earlierUnconfirmed);
        return;
      }
      const pending = doubts.find((g) => g.postId === postId) ?? null;
      // Restored before anything else can fail, so a retry is always exactly this gift.
      uncertainGift.current = pending;
      if (pending) {
        setGiftCurrency(pending.currency);
        setGiftQuantity(pending.quantity);
        setGiftLocked(true);
        giftKey.current = pending.key;
      }
      if (settledAny) {
        // One may have just been sent: read the balance again before offering this one, and
        // stop if another account is signed in now.
        const after = await postGiftsService.balance();
        if (version !== giftLoadVersion.current) return;
        if (after.userId !== member) {
          uncertainGift.current = null;
          setGiftTarget(null);
          setShareNote(GIFT_COPY.otherAccount);
          return;
        }
        setGiftSummary(after);
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
    const recovered = uncertainGift.current;
    // A recovered gift goes as its sender (the API refuses it if someone else is signed in now).
    const member = recovered?.member ?? giftSummary?.userId;
    // A gift is only sent knowing whose wallet it comes from.
    if (giftBusy.current || !giftTarget || !member || (!giftLocked && !quote.valid)) return;
    // A retry is exactly the gift in doubt (its key and amount), never the form's.
    const attempt: GiftInDoubt = recovered
      ? {
          postId: recovered.postId,
          currency: recovered.currency,
          quantity: recovered.quantity,
          key: recovered.key,
        }
      : {
          postId: giftTarget.postId,
          currency: giftCurrency,
          quantity: giftQuantity,
          key: giftKey.current,
        };
    giftBusy.current = true;
    setGiftSending(true);
    setGiftError(null);
    try {
      // One tab at a time sends this member's money requests, deciding from the kept copies
      // as they are once it holds the lock.
      const outcome = await pendingTransfersService.exclusive(member, async () => {
        const doubts = giftsInDoubt(member);
        if (recovered && !doubts.some((g) => g.key === recovered.key)) {
          uncertainGift.current = null;
          return "answered elsewhere" as const;
        }
        // Nothing new while another gift is in doubt (another tab's): it would be left behind.
        if (!recovered && doubts.length > 0) return "another in doubt" as const;
        // Kept before it's sent: if the page goes before the answer comes, a retry reuses its
        // key. (Storage can be off or full: then it's this page's own record.)
        const persisted = pendingTransfersService.keepGift(member, attempt);
        uncertainGift.current = { ...attempt, member, persisted };
        try {
          await postGiftsService.send(
            attempt.postId,
            attempt.currency,
            Number(attempt.quantity),
            attempt.key,
            member,
          );
        } catch (e) {
          const failure = pendingTransfersService.failure(e);
          // Refused: nothing was made. Unread: this send wasn't read, and with the lock held no
          // other tab has sent it, so a first send is settled too. No answer: kept.
          if (failure === "refused" || (failure === "unread" && !recovered))
            settleGift(member, attempt.key);
          return { failure, message: e instanceof Error ? e.message : "Please try again." };
        }
        settleGift(member, attempt.key);
        return "sent" as const;
      });
      if (outcome === "answered elsewhere") {
        setGiftLocked(false);
        setGiftTarget(null);
        setShareNote(GIFT_COPY.answeredElsewhere);
      } else if (outcome === "another in doubt") {
        setGiftError(GIFT_COPY.earlierUnconfirmed);
      } else if (outcome === "sent") {
        setGiftLocked(false);
        setShareNote(
          postGiftsService.sentLabel(attempt.quantity, attempt.currency, giftTarget.name),
        );
        setGiftTarget(null);
        // Read the committed count so a retried, idempotent gift never counts twice.
        const updated = await postsApi.byId(attempt.postId).catch(() => null);
        if (updated)
          setPosts((prev) =>
            applyToContent(prev, updated.postId, (p) => ({ ...p, gifts: updated.gifts ?? 0 })),
          );
      } else if (outcome.failure === "refused" || (outcome.failure === "unread" && !recovered)) {
        setGiftLocked(false);
        setGiftError(outcome.message);
      } else if (outcome.failure === "unread") {
        // Says nothing about the earlier send: still in doubt, key and all.
        setGiftLocked(true);
        setGiftError(outcome.message);
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
    /** The home feed's For You | Following | Nearby; none elsewhere. */
    tabs,
    selectTab,
    /** What the feed says when it has nothing to show. */
    empty,
    /** "Kinksters Near You" belongs to For You and Nearby, not to Following. */
    showPeople: tab === "for_you" || tab === "nearby",
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
    editor: {
      ...FEED_EDITOR,
      selection: draftSelection,
      previewParts: draftPreviewParts,
      onFormat: formatDraft,
      onInsert: insertDraft,
    },
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
    tagFriends: tagPicker.vm,
    removeTag,

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

    suggestions: suggestionVMs,
    suggestionSegments,
    suggestionsLoading,
    showSuggestions,
    removeSuggestion,
    toggleFollow,
  };
}

export type FeedVM = ReturnType<typeof useFeedPresenter>;
