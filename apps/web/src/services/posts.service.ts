/**
 * Home feed: API access plus the pure rules the feed screens share (optimistic
 * like flips, what counts as a postable draft, how a photo reaches S3).
 */
import {
  COMMENT_BODY_MAX,
  DEFAULT_FEED_TAB,
  isFeedTab,
  POST_MEDIA_MAX,
  type CommentPM,
  type CommentsPM,
  type FeedPM,
  type FeedSuggestionPM,
  type FeedSuggestionsPM,
  type FeedTab,
  type LikePM,
  type PostPM,
  type PostVisibility,
  type RepostPM,
  type SavePM,
  type SuggestionShow,
} from "@/domain/post";
import { IMAGE_VARIANTS, buildUploadSet, type ImageVariant } from "@/util/image";
import { api, uploadToPresignedUrl } from "./apiClient";

interface PostUploadSpec {
  key: string;
  uploadUrl: string;
  variantUploadUrls: Record<ImageVariant, string>;
  expiresInSeconds: number;
  maxSizeMb: number;
  maxFiles: number;
}

export interface CreatePostInput {
  body: string;
  visibility: PostVisibility;
  /** Keys returned by `uploadPostPhoto`, in the order they should appear. */
  mediaKeys: string[];
}

export const postsApi = {
  /**
   * `author` narrows the feed to one member — that is the profile Posts tab.
   * `search` keeps the posts whose text contains it. `tab` is the home feed's
   * For You, Following or Nearby; the API reads newest first without one.
   */
  feed: (
    cursor?: string | null,
    limit?: number,
    author?: string | null,
    search?: string | null,
    tab?: FeedTab | null,
  ) => {
    const qs = new URLSearchParams();
    if (tab) qs.set("tab", tab);
    if (cursor) qs.set("cursor", cursor);
    if (limit) qs.set("limit", String(limit));
    if (author) qs.set("author", author.replace(/^@/, ""));
    if (search) qs.set("q", search);
    const q = qs.toString();
    return api.get<FeedPM>(`/posts/feed${q ? `?${q}` : ""}`);
  },
  create: (input: CreatePostInput) =>
    api.post<PostPM>("/posts", {
      body: input.body.trim() || undefined,
      visibility: input.visibility,
      media: input.mediaKeys.map((key) => ({ key, kind: "image" as const })),
    }),
  byId: (id: string) => api.get<PostPM>(`/posts/${encodeURIComponent(id)}`),
  remove: (id: string) => api.del<{ deleted: string }>(`/posts/${encodeURIComponent(id)}`),
  like: (id: string) => api.post<LikePM>(`/posts/${encodeURIComponent(id)}/like`, {}),
  unlike: (id: string) => api.del<LikePM>(`/posts/${encodeURIComponent(id)}/like`),
  share: (id: string) =>
    api.post<{ postId: string; shares: number }>(`/posts/${encodeURIComponent(id)}/share`, {}),
  repost: (id: string) => api.post<RepostPM>(`/posts/${encodeURIComponent(id)}/repost`, {}),
  unrepost: (id: string) => api.del<RepostPM>(`/posts/${encodeURIComponent(id)}/repost`),
  save: (id: string) => api.post<SavePM>(`/posts/${encodeURIComponent(id)}/save`, {}),
  unsave: (id: string) => api.del<SavePM>(`/posts/${encodeURIComponent(id)}/save`),
  saved: (cursor?: string | null, limit?: number) => {
    const qs = new URLSearchParams();
    if (cursor) qs.set("cursor", cursor);
    if (limit) qs.set("limit", String(limit));
    const q = qs.toString();
    return api.get<FeedPM>(`/posts/saved${q ? `?${q}` : ""}`);
  },
  comments: (id: string, cursor?: string | null, limit?: number) => {
    const qs = new URLSearchParams();
    if (cursor) qs.set("cursor", cursor);
    if (limit) qs.set("limit", String(limit));
    const q = qs.toString();
    return api.get<CommentsPM>(`/posts/${encodeURIComponent(id)}/comments${q ? `?${q}` : ""}`);
  },
  comment: (id: string, body: string) =>
    api.post<CommentPM>(`/posts/${encodeURIComponent(id)}/comments`, { body }),
  removeComment: (id: string) =>
    api.del<{ deleted: string }>(`/posts/comments/${encodeURIComponent(id)}`),
  /** "Kinksters Near You". Without `show`, the API picks the member's own default. */
  suggested: (limit = 10, show?: SuggestionShow | null) =>
    api.get<FeedSuggestionsPM>(`/members/suggested?limit=${limit}${show ? `&show=${show}` : ""}`),
  /** Remove a card for good: the member is never suggested to the viewer again. */
  dismissSuggestion: (userId: string) =>
    api.post<{ dismissed: string }>(`/members/suggested/${encodeURIComponent(userId)}/dismiss`, {}),
  follow: (username: string) =>
    api.post<unknown>(`/follows/${encodeURIComponent(username.replace(/^@/, ""))}`, {}),
  unfollow: (username: string) =>
    api.del<unknown>(`/follows/${encodeURIComponent(username.replace(/^@/, ""))}`),
};

const FEED_TAB_KEY = "kinkord:feed-tab";

/**
 * The home feed's tab, kept for this browser session, so a reload or a walk
 * to a profile and back lands on the same tab. Session storage can be off or
 * full (private mode): then nothing is kept and the feed opens on For You,
 * as a new session does.
 */
export const feedTabMemory = {
  /** The tab this session last showed, else For You. */
  read(): FeedTab {
    try {
      const kept = sessionStorage.getItem(FEED_TAB_KEY);
      return isFeedTab(kept) ? kept : DEFAULT_FEED_TAB;
    } catch {
      return DEFAULT_FEED_TAB;
    }
  },
  remember(tab: FeedTab): void {
    try {
      sessionStorage.setItem(FEED_TAB_KEY, tab);
    } catch {
      // Not kept: the tab still switches, for this visit.
    }
  },
};

/**
 * The next page after what is on screen, less any row already shown. A ranked
 * page can repeat a row when the world moved between pages; showing it twice
 * would be worse than dropping it.
 */
export function appendNewRows(shown: PostPM[], next: PostPM[]): PostPM[] {
  const ids = new Set(shown.map((p) => p.id));
  return [...shown, ...next.filter((p) => !ids.has(p.id))];
}

/**
 * One photo into the bucket, every stored size, before the post exists. The key
 * comes back and is named in `create`; if the member abandons the composer the
 * objects are simply never referenced.
 */
export async function uploadPostPhoto(rawFile: File): Promise<string> {
  const { original, variants } = await buildUploadSet(rawFile, "post");
  const spec = await api.post<PostUploadSpec>("/posts/upload-url", {
    contentType: original.type,
    contentLength: original.size,
  });
  await Promise.all(
    IMAGE_VARIANTS.map((v) => uploadToPresignedUrl(spec.variantUploadUrls[v], variants[v])),
  );
  await uploadToPresignedUrl(spec.uploadUrl, original);
  return spec.key;
}

/** Optimistic like flip, applied before the request so the tap feels instant. */
export function toggleLikeOnPost(pm: PostPM): PostPM {
  return {
    ...pm,
    likedByMe: !pm.likedByMe,
    likes: pm.likedByMe ? Math.max(0, pm.likes - 1) : pm.likes + 1,
  };
}

export function toggleRepostOnPost(pm: PostPM): PostPM {
  return {
    ...pm,
    repostedByMe: !pm.repostedByMe,
    reposts: pm.repostedByMe ? Math.max(0, pm.reposts - 1) : pm.reposts + 1,
  };
}

export function toggleSaveOnPost(pm: PostPM): PostPM {
  return { ...pm, savedByMe: !pm.savedByMe };
}

/**
 * Applies a server answer to every row showing that post. A post and any number
 * of reposts of it can sit in one feed, and they must not disagree about how
 * many likes it has.
 */
export function applyLike(pm: PostPM, like: LikePM): PostPM {
  return pm.postId === like.postId ? { ...pm, likes: like.likes, likedByMe: like.likedByMe } : pm;
}

export function applyRepost(pm: PostPM, result: RepostPM): PostPM {
  return pm.postId === result.postId
    ? { ...pm, reposts: result.reposts, repostedByMe: result.repostedByMe }
    : pm;
}

export function applySave(pm: PostPM, result: SavePM): PostPM {
  return pm.postId === result.postId ? { ...pm, savedByMe: result.savedByMe } : pm;
}

/** Every row showing this post, by the post it points at rather than by row id. */
export function applyToContent(
  items: PostPM[],
  postId: string,
  fn: (pm: PostPM) => PostPM,
): PostPM[] {
  return items.map((p) => (p.postId === postId ? fn(p) : p));
}

export function replacePost(items: PostPM[], next: PostPM): PostPM[] {
  return items.map((p) => (p.id === next.id ? next : p));
}

export function applyToPost(items: PostPM[], id: string, fn: (pm: PostPM) => PostPM): PostPM[] {
  return items.map((p) => (p.id === id ? fn(p) : p));
}

/** A post needs words or a photo; whitespace alone is not a post. */
export function canSubmitPost(body: string, photoCount: number): boolean {
  return body.trim().length > 0 || photoCount > 0;
}

export function canSubmitComment(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= COMMENT_BODY_MAX;
}

/** How many more photos this draft will accept. */
export function remainingPhotoSlots(current: number): number {
  return Math.max(0, POST_MEDIA_MAX - current);
}

/**
 * Whether the viewer follows a member, set on every place the feed shows them —
 * each of their posts (a repost's author is the original's) and their
 * suggestion card — so one follow can't leave two of them disagreeing.
 */
export function withAuthorFollow(items: PostPM[], userId: string, isFollowing: boolean): PostPM[] {
  return items.map((p) =>
    p.author.userId === userId ? { ...p, author: { ...p.author, isFollowing } } : p,
  );
}

export function withSuggestionFollow(
  items: FeedSuggestionPM[],
  userId: string,
  isFollowing: boolean,
): FeedSuggestionPM[] {
  return items.map((s) => (s.userId === userId ? { ...s, isFollowing } : s));
}

/** Puts back a card whose removal the API refused, where it was (once). */
export function withSuggestionRestored(
  items: FeedSuggestionPM[],
  person: FeedSuggestionPM,
  index: number,
): FeedSuggestionPM[] {
  if (items.some((s) => s.userId === person.userId)) return items;
  const at = Math.min(Math.max(0, index), items.length);
  return [...items.slice(0, at), person, ...items.slice(at)];
}

/**
 * Where a post lives on its own. Built from the site origin so a shared link
 * works from any environment, and left to the caller in SSR where there is no
 * window to read.
 */
export function postPermalink(postId: string, origin?: string): string {
  const base = origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}/p/${encodeURIComponent(postId)}`;
}

/** Bumps a post's comment count after one is added or removed. */
export function withCommentDelta(pm: PostPM, delta: number): PostPM {
  return { ...pm, comments: Math.max(0, pm.comments + delta) };
}
