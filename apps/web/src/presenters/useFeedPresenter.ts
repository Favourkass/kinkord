"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FEED_COPY, FEED_PHOTO_LIMIT, FEED_SUGGESTION_LIMIT } from "@/constants/feed";
import { Routes } from "@/constants/Routes";
import {
  handleOf,
  toCommentVM,
  toPostVM,
  type CommentPM,
  type CommentVM,
  type DraftPhotoVM,
  type FeedSuggestionVM,
  type PostMediaVM,
  type PostPM,
  type PostVM,
  type PostVisibility,
} from "@/domain/post";
import { ApiError } from "@/services/apiClient";
import {
  applyLike,
  applyToPost,
  canSubmitComment,
  canSubmitPost,
  postsApi,
  remainingPhotoSlots,
  toggleFollowOnSuggestion,
  toggleLikeOnPost,
  uploadPostPhoto,
  withCommentDelta,
  type SuggestedPersonPM,
} from "@/services/posts.service";

/** Profile link for an author; null for a member who has no username yet. */
const memberHref = (username: string | null) => (username ? Routes.member(username) : null);

interface DraftPhoto extends DraftPhotoVM {
  key: string | null;
}

/**
 * The home feed: reading it, writing to it, and reacting to it.
 *
 * Photos upload the moment they are picked rather than on submit, so the Post
 * button is instant on the connection most members are on — by the time the
 * caption is typed the bytes are usually already in the bucket.
 */
export function useFeedPresenter() {
  const router = useRouter();

  const [posts, setPosts] = useState<PostPM[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
  const [commentSending, setCommentSending] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<PostMediaVM | null>(null);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [suggestions, setSuggestions] = useState<SuggestedPersonPM[]>([]);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  const [followBusy, setFollowBusy] = useState<string[]>([]);

  /** Object URLs outlive React state, so they are revoked by hand. */
  const previewUrls = useRef<string[]>([]);

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
    let cancelled = false;
    void (async () => {
      try {
        const page = await postsApi.feed();
        if (cancelled) return;
        setPosts(page.items);
        setCursor(page.nextCursor);
      } catch (e) {
        if (cancelled || onUnauthorized(e)) return;
        setError(FEED_COPY.feedError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onUnauthorized]);

  useEffect(() => {
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
  }, []);

  // Revoke every preview on unmount so a long session doesn't leak blobs.
  useEffect(
    () => () => {
      previewUrls.current.forEach((u) => URL.revokeObjectURL(u));
      previewUrls.current = [];
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await postsApi.feed(cursor);
      setPosts((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      if (!onUnauthorized(e)) setError(FEED_COPY.feedError);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, onUnauthorized]);

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
    setVisibility("public");
    setComposerError(null);
    discardPhotos();
  }, [discardPhotos]);

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

  const toggleLike = useCallback(
    async (id: string) => {
      const before = posts.find((p) => p.id === id);
      if (!before) return;
      setPosts((prev) => applyToPost(prev, id, toggleLikeOnPost));
      try {
        const result = before.likedByMe ? await postsApi.unlike(id) : await postsApi.like(id);
        setPosts((prev) => prev.map((p) => applyLike(p, result)));
      } catch (e) {
        if (onUnauthorized(e)) return;
        // Put the card back the way the server still sees it.
        setPosts((prev) => applyToPost(prev, id, toggleLikeOnPost));
      }
    },
    [posts, onUnauthorized],
  );

  // ---- comments ---------------------------------------------------------

  const openComments = useCallback(
    async (id: string) => {
      setCommentsFor(id);
      setComments([]);
      setCommentsCursor(null);
      setCommentDraft("");
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
    [onUnauthorized],
  );

  const closeComments = useCallback(() => {
    setCommentsFor(null);
    setComments([]);
    setCommentsCursor(null);
    setCommentDraft("");
    setCommentsError(null);
  }, []);

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
    } catch (e) {
      if (onUnauthorized(e)) return;
      setCommentsError(
        e instanceof ApiError ? e.message : "Could not post that comment. Try again.",
      );
    } finally {
      setCommentSending(false);
    }
  }, [commentsFor, commentDraft, commentSending, onUnauthorized]);

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

  return {
    loading,
    error,
    posts: postVMs,
    hasMore: Boolean(cursor),
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
    setDraft,
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

    commentsFor,
    comments: commentVMs,
    commentsLoading,
    commentsError,
    commentsHasMore: Boolean(commentsCursor),
    loadMoreComments,
    openComments,
    closeComments,
    commentDraft,
    setCommentDraft,
    commentSending,
    canComment: canSubmitComment(commentDraft) && !commentSending,
    submitComment,
    deleteComment,

    menuFor,
    openMenu,
    closeMenu,
    askDelete,
    confirmDelete,
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
