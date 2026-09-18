/**
 * Home feed: API access plus the pure rules the feed screens share (optimistic
 * like flips, what counts as a postable draft, how a photo reaches S3).
 */
import {
  COMMENT_BODY_MAX,
  POST_MEDIA_MAX,
  type CommentPM,
  type CommentsPM,
  type FeedPM,
  type LikePM,
  type PostPM,
  type PostVisibility,
  type RepostPM,
  type SavePM,
} from "@/domain/post";
import { IMAGE_VARIANTS, buildUploadSet, type ImageVariant } from "@/util/image";
import { api, uploadToPresignedUrl } from "./apiClient";

export interface SuggestedPersonPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
}

export interface SuggestedPM {
  items: SuggestedPersonPM[];
  total: number;
}

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
  /** `author` narrows the feed to one member — that is the profile Posts tab. */
  feed: (cursor?: string | null, limit?: number, author?: string | null) => {
    const qs = new URLSearchParams();
    if (cursor) qs.set("cursor", cursor);
    if (limit) qs.set("limit", String(limit));
    if (author) qs.set("author", author.replace(/^@/, ""));
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
  suggested: (limit = 10) => api.get<SuggestedPM>(`/members/suggested?limit=${limit}`),
  follow: (username: string) =>
    api.post<unknown>(`/follows/${encodeURIComponent(username.replace(/^@/, ""))}`, {}),
  unfollow: (username: string) =>
    api.del<unknown>(`/follows/${encodeURIComponent(username.replace(/^@/, ""))}`),
};

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

export function toggleFollowOnSuggestion(pm: SuggestedPersonPM): SuggestedPersonPM {
  return { ...pm, isFollowing: !pm.isFollowing };
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
