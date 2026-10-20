/**
 * Home feed posts. PMs mirror the API payloads; `toVM` shapes them for the
 * card — relative time, compact counts, and the "… more" clamp the design puts
 * on a long body.
 */
import { formattedBodyParts } from "./text-format";
import { compactNumber, shortTimeAgo } from "@/util/format";
import { ageTagOf, fullLocationOf } from "./member";
import { bodyParts, clipParts, type BodyPart, type MentionPM } from "./mentions";

export type PostVisibility = "public" | "friends";

export interface PostAuthorPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Shows the Silver check beside their name; absent from an older API. */
  teamMember?: boolean;
  silver?: boolean;
  subscribed?: boolean;
  /** Whether the viewer follows them; absent from an older API. */
  isFollowing?: boolean;
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
  /** Completed shares/link copies; absent from older APIs. */
  shares?: number;
  /** Number of completed gift transfers to this post. */
  gifts?: number;
  comments: number;
  reposts: number;
  likedByMe: boolean;
  repostedByMe: boolean;
  savedByMe: boolean;
  /** Set when this row is somebody's repost of the post above. */
  repostedBy: Pick<PostAuthorPM, "userId" | "username" | "displayName"> | null;
  mine: boolean;
  /** Each @handle in the body that names a member, and whom. Absent from an older API. */
  mentions?: MentionPM[];
}

/** The home feed's tabs, as the API names them. */
export const FEED_TABS = ["for_you", "following", "nearby"] as const;
export type FeedTab = (typeof FEED_TABS)[number];
/** Where the home feed opens in a new session. */
export const DEFAULT_FEED_TAB: FeedTab = "for_you";

export function isFeedTab(value: unknown): value is FeedTab {
  return typeof value === "string" && (FEED_TABS as readonly string[]).includes(value);
}

/**
 * Why a tab may be empty, so the feed can say what would fill it: the viewer
 * follows nobody (Following), or has no state (Nearby).
 */
export type FeedHint = "no_follows" | "no_location";

export interface FeedPM {
  items: PostPM[];
  nextCursor: string | null;
  /** Absent from an older API, and whenever there is nothing to say. */
  hint?: FeedHint | null;
}

/** One tab of the home feed's For You | Following | Nearby. */
export interface FeedTabVM {
  value: FeedTab;
  label: string;
  selected: boolean;
}

/** What an empty feed says, and the one thing to do about it when there is one. */
export interface FeedEmptyVM {
  title: string;
  body: string | null;
  action: { label: string; href: string } | null;
}

export interface CommentPM {
  id: string;
  body: string;
  createdAt: string;
  author: PostAuthorPM;
  canDelete: boolean;
  /** Each @handle in the body that names a member, and whom. Absent from an older API. */
  mentions?: MentionPM[];
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
  authorUserId: string;
  authorName: string;
  /** The Silver check beside the author's name. */
  authorTeamMember?: boolean;
  authorSilver: boolean;
  authorSubscribed: boolean;
  /** The official organization's posts carry its marks. */
  authorOrganization: boolean;
  authorOrganizationVerified: boolean;
  /**
   * A Follow button beside the name: on the official organization's posts, never
   * on the viewer's own, and only once the API has said whether they follow it.
   */
  canFollowAuthor: boolean;
  authorIsFollowing: boolean;
  /** A follow request is in flight, so the button is held. */
  authorFollowBusy: boolean;
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
  shares: string;
  gifts: string;
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

/** Which members "Kinksters Near You" lists: women, men, or both mixed. */
export type SuggestionShow = "women" | "men" | "all";

/** One "Kinksters Near You" card, as GET /members/suggested sends it. */
export interface FeedSuggestionPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
  /** Shows the Silver check; absent from an older API, like everything below. */
  teamMember?: boolean;
  silver?: boolean;
  age?: number | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
  /** ISO 3166-1 alpha-2. */
  country?: string | null;
  /** At most three, those on the side the viewer looks for first. */
  roles?: string[];
  lookingFor?: string[];
  online?: boolean;
}

export interface FeedSuggestionsPM {
  items: FeedSuggestionPM[];
  /** The segment the API ranked for: the one asked for, or the member's default. */
  show?: SuggestionShow;
  /** The segments to offer, in order. */
  options?: SuggestionShow[];
}

/** How many roles and looking-for values a card shows. */
export const SUGGESTION_LIST_MAX = 3;

/** A "Kinksters Near You" card. */
export interface FeedSuggestionVM {
  userId: string;
  displayName: string;
  teamMember?: boolean;
  silver: boolean;
  organization: boolean;
  avatarUrl: string | null;
  online: boolean;
  /** "26F • Lagos, Lagos State, Nigeria"; null when unknown, and for the organization. */
  details: string | null;
  /** "Submissive, Switch, Brat"; null when none, and for the organization. */
  roles: string | null;
  /** "Friendship, Events, Vanilla dating"; null when none, and for the organization. */
  lookingFor: string | null;
  isFollowing: boolean;
  /** A follow request is in flight, so the button is held. */
  busy: boolean;
  href: string | null;
}

/** One segment of the Women | Men (| All) toggle. */
export interface SuggestionSegmentVM {
  value: SuggestionShow;
  label: string;
  selected: boolean;
}

export interface CommentVM {
  id: string;
  authorName: string;
  authorTeamMember?: boolean;
  authorSilver: boolean;
  authorOrganization: boolean;
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

/**
 * The viewer wrote what the card shows: their own post, or their repost of it.
 * `mine` alone is about the row, and a repost of someone else's post is the
 * viewer's row with somebody else's words.
 */
function byViewer(pm: PostPM): boolean {
  return pm.mine && (pm.repostedBy === null || pm.repostedBy.userId === pm.author.userId);
}

/** `organization` is whether the author is the official organization; presenters decide it. */
export function toPostVM(
  pm: PostPM,
  expanded: boolean,
  hrefFor: HrefFor,
  now = new Date(),
  organization = false,
): PostVM {
  const canExpand = needsClamp(pm.body);
  // How much of the body shows: all of it, or what fits before "more".
  const shown = pm.body && canExpand && !expanded ? clampLength(pm.body) : null;
  const body = pm.body && shown !== null ? clampBody(pm.body) : pm.body;
  // Mentions are read on the whole text, then cut: a handle the clamp cuts
  // short reads as text until "more", never as whoever its first letters name.
  const parts = pm.body ? formattedBodyParts(pm.body, pm.mentions, (u) => hrefFor(u) ?? "") : [];
  return {
    id: pm.id,
    postId: pm.postId,
    repostedByName: pm.repostedBy?.displayName ?? null,
    isRepost: pm.id !== pm.postId,
    authorUserId: pm.author.userId,
    authorName: pm.author.displayName,
    authorTeamMember: Boolean(pm.author.teamMember),
    authorSilver: Boolean(pm.author.silver),
    authorSubscribed: Boolean(pm.author.subscribed),
    authorOrganization: organization,
    authorOrganizationVerified: organization,
    canFollowAuthor: organization && !byViewer(pm) && typeof pm.author.isFollowing === "boolean",
    authorIsFollowing: Boolean(pm.author.isFollowing),
    authorFollowBusy: false,
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
    shares: compactNumber(pm.shares ?? 0),
    gifts: compactNumber(pm.gifts ?? 0),
    comments: compactNumber(pm.comments),
    reposts: compactNumber(pm.reposts),
    likedByMe: pm.likedByMe,
    repostedByMe: pm.repostedByMe,
    savedByMe: pm.savedByMe,
    mine: pm.mine,
    visibilityNote: pm.visibility === "friends" ? "Friends only" : null,
  };
}

export function toCommentVM(
  pm: CommentPM,
  hrefFor: HrefFor,
  now = new Date(),
  organization = false,
): CommentVM {
  return {
    id: pm.id,
    authorName: pm.author.displayName,
    authorTeamMember: Boolean(pm.author.teamMember),
    authorSilver: Boolean(pm.author.silver),
    authorOrganization: organization,
    handle: handleOf(pm.author.username),
    authorHref: hrefFor(pm.author.username),
    avatarUrl: pm.author.avatarUrl,
    time: shortTimeAgo(pm.createdAt, now) ?? "",
    body: pm.body,
    bodyParts: bodyParts(pm.body, pm.mentions, (u) => hrefFor(u) ?? ""),
    canDelete: pm.canDelete,
  };
}

/**
 * A "Kinksters Near You" card. The organization's card is just its name and
 * the Follow button: age, place, roles and presence only describe a person.
 */
export function toFeedSuggestionVM(
  pm: FeedSuggestionPM,
  hrefFor: HrefFor,
  busy = false,
  organization = false,
): FeedSuggestionVM {
  const list = (values: string[] | undefined) =>
    organization ? null : (values ?? []).slice(0, SUGGESTION_LIST_MAX).join(", ") || null;
  const details = [
    ageTagOf(pm.age ?? null, pm.gender ?? null),
    fullLocationOf(pm.city, pm.state, pm.country),
  ]
    .filter(Boolean)
    .join(" • ");
  return {
    userId: pm.userId,
    displayName: pm.displayName,
    teamMember: Boolean(pm.teamMember),
    silver: Boolean(pm.silver),
    organization,
    avatarUrl: pm.avatarUrl,
    online: !organization && Boolean(pm.online),
    details: organization ? null : details || null,
    roles: list(pm.roles),
    lookingFor: list(pm.lookingFor),
    isFollowing: pm.isFollowing,
    busy,
    href: hrefFor(pm.username),
  };
}
