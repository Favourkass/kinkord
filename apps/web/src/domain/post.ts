/**
 * Home feed posts. PMs mirror the API payloads; `toVM` shapes them for the
 * card — relative time, compact counts, and the "… more" clamp the design puts
 * on a long body.
 */
import { compactNumber, shortTimeAgo } from "@/util/format";
import { bodyParts, clipParts, type BodyPart } from "./mentions";

export type PostVisibility = "public" | "friends";

export interface PostAuthorPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Shows the Silver check beside their name; absent from an older API. */
  silver?: boolean;
}

export interface PostMediaPM {
  id: string;
  kind: "image" | "video";
  /** Grid-sized copy. */
  thumbUrl: string | null;
  /** Full-width / lightbox copy. */
  url: string | null;
}

export interface PostPM {
  /** The row in the feed — a repost has its own id, and a delete removes that. */
  id: string;
  /** The post the content belongs to; every reaction targets this. */
  postId: string;
  body: string | null;
  visibility: PostVisibility;
  createdAt: string;
  author: PostAuthorPM;
  media: PostMediaPM[];
  likes: number;
  comments: number;
  reposts: number;
  likedByMe: boolean;
  repostedByMe: boolean;
  savedByMe: boolean;
  /** Set when this row is somebody's repost of the post above. */
  repostedBy: Pick<PostAuthorPM, "userId" | "username" | "displayName"> | null;
  mine: boolean;
  /** The @handles in the body that are members, lowercased. Absent from an older API. */
  mentions?: string[];
}

export interface FeedPM {
  items: PostPM[];
  nextCursor: string | null;
}

export interface CommentPM {
  id: string;
  body: string;
  createdAt: string;
  author: PostAuthorPM;
  canDelete: boolean;
  /** The @handles in the body that are members, lowercased. Absent from an older API. */
  mentions?: string[];
}

export interface CommentsPM {
  items: CommentPM[];
  total: number;
  nextCursor: string | null;
}

/** Likes/unlikes answer with the post's fresh count, so a stale tap self-corrects. */
export interface LikePM {
  postId: string;
  likes: number;
  likedByMe: boolean;
}

export interface RepostPM {
  postId: string;
  reposts: number;
  repostedByMe: boolean;
}

export interface SavePM {
  postId: string;
  savedByMe: boolean;
}

/** Matches the API's POST_BODY_MAX / COMMENT_BODY_MAX. */
export const POST_BODY_MAX = 2000;
/** Silver's longer posts, matching the API's SILVER_POST_BODY_MAX. */
export const SILVER_POST_BODY_MAX = 25_000;

/** How long a post this member may write. */
export function postBodyMax(silver: boolean): number {
  return silver ? SILVER_POST_BODY_MAX : POST_BODY_MAX;
}
export const COMMENT_BODY_MAX = 1000;
export const POST_MEDIA_MAX = 4;

/**
 * Characters shown before the body is clamped. The design truncates around one
 * line on a 440px frame; this is generous enough to keep short posts whole.
 */
export const POST_PREVIEW_CHARS = 140;

export interface PostMediaVM {
  id: string;
  /** What the card renders: the grid copy for a tile, the wide copy when alone. */
  src: string | null;
  /** Opened by a tap. */
  fullSrc: string | null;
  alt: string;
}

export interface PostVM {
  id: string;
  /** What a reaction acts on: the original when this row is a repost. */
  postId: string;
  /** "Favour reposted" line above the card; null on an ordinary post. */
  repostedByName: string | null;
  /**
   * This row is a repost, not the post itself. The card shows somebody else's
   * words, so its menu must offer to undo the repost — never to delete a post
   * that is not the viewer's to delete.
   */
  isRepost: boolean;
  authorName: string;
  /** The Silver check beside the author's name. */
  authorSilver: boolean;
  handle: string | null;
  /** Link to the author's profile, or null for a member with no username yet. */
  authorHref: string | null;
  avatarUrl: string | null;
  time: string;
  /** Already clamped when `canExpand` is true and the reader hasn't expanded it. */
  body: string | null;
  /** The body as text and @mention links. */
  bodyParts: BodyPart[];
  /** Offer the "more" affordance. */
  canExpand: boolean;
  expanded: boolean;
  media: PostMediaVM[];
  likes: string;
  comments: string;
  reposts: string;
  likedByMe: boolean;
  repostedByMe: boolean;
  savedByMe: boolean;
  mine: boolean;
  /** Friends-only posts say so, so nobody is surprised by who can read them. */
  visibilityNote: string | null;
}

/** A photo in the composer: local preview first, S3 key once it has landed. */
export interface DraftPhotoVM {
  id: string;
  previewUrl: string;
  uploading: boolean;
  error: string | null;
}

/** A "People you may know" card. */
export interface FeedSuggestionVM {
  userId: string;
  displayName: string;
  silver: boolean;
  handle: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
  /** A follow request is in flight, so the button is held. */
  busy: boolean;
  href: string | null;
}

export interface CommentVM {
  id: string;
  authorName: string;
  authorSilver: boolean;
  handle: string | null;
  authorHref: string | null;
  avatarUrl: string | null;
  time: string;
  body: string;
  /** The body as text and @mention links. */
  bodyParts: BodyPart[];
  canDelete: boolean;
}

/** "@tega" from a username, or null when the member hasn't set one. */
export function handleOf(username: string | null): string | null {
  return username ? `@${username}` : null;
}

/** Routing lives in the presenter layer, so the caller supplies the link builder. */
export type HrefFor = (username: string | null) => string | null;

/** True when the body is long enough that the card should clamp it. */
export function needsClamp(body: string | null): boolean {
  return (body?.length ?? 0) > POST_PREVIEW_CHARS;
}

/** How much of a long body the card shows: up to a word boundary, so it doesn't end mid-word. */
function clampLength(body: string): number {
  const cut = body.slice(0, POST_PREVIEW_CHARS);
  const space = cut.lastIndexOf(" ");
  return (space > POST_PREVIEW_CHARS * 0.6 ? cut.slice(0, space) : cut).trimEnd().length;
}

/** The clamped body, cut on a word boundary so it doesn't end mid-word. */
export function clampBody(body: string): string {
  return `${body.slice(0, clampLength(body))}…`;
}

export function toPostVM(
  pm: PostPM,
  expanded: boolean,
  hrefFor: HrefFor,
  now = new Date(),
): PostVM {
  const canExpand = needsClamp(pm.body);
  // How much of the body shows: all of it, or what fits before "more".
  const shown = pm.body && canExpand && !expanded ? clampLength(pm.body) : null;
  const body = pm.body && shown !== null ? clampBody(pm.body) : pm.body;
  // Mentions are read on the whole text, then cut: a handle the clamp cuts
  // short reads as text until "more", never as whoever its first letters name.
  const parts = pm.body ? bodyParts(pm.body, pm.mentions, (u) => hrefFor(u) ?? "") : [];
  return {
    id: pm.id,
    postId: pm.postId,
    repostedByName: pm.repostedBy?.displayName ?? null,
    isRepost: pm.id !== pm.postId,
    authorName: pm.author.displayName,
    authorSilver: Boolean(pm.author.silver),
    handle: handleOf(pm.author.username),
    authorHref: hrefFor(pm.author.username),
    avatarUrl: pm.author.avatarUrl,
    time: shortTimeAgo(pm.createdAt, now) ?? "",
    body,
    bodyParts: shown === null ? parts : [...clipParts(parts, shown), { text: "…" }],
    canExpand,
    expanded,
    media: pm.media.map((m, i) => ({
      id: m.id,
      // A lone photo runs the full width of the card, so it gets the wide copy.
      src: (pm.media.length === 1 ? m.url : m.thumbUrl) ?? m.url,
      fullSrc: m.url,
      alt: `Photo ${i + 1} from ${pm.author.displayName}`,
    })),
    likes: compactNumber(pm.likes),
    comments: compactNumber(pm.comments),
    reposts: compactNumber(pm.reposts),
    likedByMe: pm.likedByMe,
    repostedByMe: pm.repostedByMe,
    savedByMe: pm.savedByMe,
    mine: pm.mine,
    visibilityNote: pm.visibility === "friends" ? "Friends only" : null,
  };
}

export function toCommentVM(pm: CommentPM, hrefFor: HrefFor, now = new Date()): CommentVM {
  return {
    id: pm.id,
    authorName: pm.author.displayName,
    authorSilver: Boolean(pm.author.silver),
    handle: handleOf(pm.author.username),
    authorHref: hrefFor(pm.author.username),
    avatarUrl: pm.author.avatarUrl,
    time: shortTimeAgo(pm.createdAt, now) ?? "",
    body: pm.body,
    bodyParts: bodyParts(pm.body, pm.mentions, (u) => hrefFor(u) ?? ""),
    canDelete: pm.canDelete,
  };
}
