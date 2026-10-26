/**
 * The home feed's ranked tabs, For You and Nearby (docs/MATCHING.md, "Feed").
 *
 * Pure rules with no database, like members/matching.ts: feed-tabs.ts gathers
 * the candidate posts and their signals as they stood at one moment (`asOf`,
 * fixed when the first page is read), and this module scores and orders them.
 * The order is a function of the viewer and `asOf` alone, so the next page is
 * read from the same list rather than a reshuffled one.
 *
 * Only the viewer's own sexuality is read. An author's kinks and looking-for
 * count only when their profile is public or the two follow each other.
 */
import { z } from "zod";
import {
  canonicalGender,
  defaultShow,
  genderShown,
  kinkParts,
  samePlace,
  type KinkProfile,
} from "../members/matching";

export const FEED_TABS = ["for_you", "following", "nearby"] as const;
export type FeedTab = (typeof FEED_TABS)[number];
export type RankedTab = Exclude<FeedTab, "following">;
const RANKED_TABS = ["for_you", "nearby"] as const satisfies readonly RankedTab[];

/** Why a tab may be empty, so the app can say what would fill it. */
export type FeedHint = "no_follows" | "no_location";

const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Which posts each ranked tab weighs, counted back from `asOf`. For You draws
 * from several pools, each newest first and capped, so no single one (and no
 * busy hour) crowds the rest out as the app grows.
 */
export const WINDOWS = {
  /** For You: every visible post this recent, the newest this many... */
  recentDays: 7,
  recentLimit: 300,
  /** ...the posts of members the viewer follows, this far back... */
  followedDays: 30,
  followedLimit: 400,
  /** ...of their accepted friends, followed or not... */
  friendsDays: 30,
  friendsLimit: 200,
  /** ...of the authors they interact with most... */
  interactedDays: 30,
  interactedLimit: 200,
  interactedAuthors: 50,
  /** ...of members in their state... */
  nearPoolDays: 14,
  nearPoolLimit: 200,
  /** ...what's taking off in their country (the most liked and commented on lately)... */
  trendingDays: 3,
  trendingLimit: 200,
  /** ...and the first posts of members who joined this week, in their country. */
  newcomerDays: 7,
  newcomerLimit: 60,
  /** Nearby: posts by members in the viewer's state. */
  nearbyDays: 14,
  nearbyLimit: 800,
  /** How far back the viewer's own likes, saves, shares, comments and reposts are read. */
  interactionDays: 60,
} as const;

/** The most rows a ranked list can hold: every For You pool full, or Nearby's. */
export const MAX_RANKED = Math.max(
  WINDOWS.recentLimit +
    WINDOWS.followedLimit +
    WINDOWS.friendsLimit +
    WINDOWS.interactedLimit +
    WINDOWS.nearPoolLimit +
    WINDOWS.trendingLimit +
    WINDOWS.newcomerLimit,
  WINDOWS.nearbyLimit,
);

/** For You: every weight in one place. docs/MATCHING.md explains them; change both together. */
export const FOR_YOU = {
  base: 1,
  follows: 6,
  followsBack: 2,
  affinity: 2.5,
  affinityCap: 30,
  kinkScale: 0.4,
  genderShown: 3,
  learnedKinks: 5,
  learnedKink: 0.5,
  learnedKinkCap: 2.5,
  engagement: 1.2,
  /**
   * Engagement counts as velocity: reactions per its age, slowed every this
   * many hours, so a post taking off now beats one that gathered likes days ago.
   */
  velocityHours: 6,
  /** A member in their first week (NEWCOMER_DAYS): their posts get a lift... */
  newcomer: 2,
  /** ...and the best one near the viewer is shown no lower than this index (the 4th card). */
  newcomerSlot: 3,
  sameCity: 2,
  sameState: 1.5,
  sameCountry: 1,
  halfLifeHours: 36,
  alreadyReacted: 0.35,
} as const;

/** Nearby: the viewer's own city first, then freshness, with engagement as a nudge. */
export const NEARBY = {
  sameCity: 2,
  sameState: 1,
  halfLifeHours: 24,
  engagement: 0.15,
} as const;

/** Never more than this many posts in a row from one member. */
export const MAX_RUN = 2;

/** How long a member counts as new, from when they joined. */
export const NEWCOMER_DAYS = 7;

export type InteractionKind = "like" | "save" | "share" | "comment" | "repost";

/** What one of the viewer's interactions says about their taste for its author. */
export const INTERACTION_WEIGHTS: Record<InteractionKind, number> = {
  like: 1,
  save: 2,
  share: 2,
  comment: 3,
  repost: 3,
};

/** How much each reaction counts toward a post's engagement. */
export const ENGAGEMENT_WEIGHTS = { likes: 1, comments: 2, reposts: 3, shares: 2 } as const;

export interface Place {
  city: string | null;
  state: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string | null;
}

/** The viewer as the feed reads them: their own profile, their own sexuality included. */
export interface FeedViewer extends KinkProfile, Place {
  gender: string | null;
  orientation: string | null;
}

/** A member whose posts are ranked. Never their sexuality. */
export interface FeedAuthor extends KinkProfile, Place {
  userId: string;
  gender: string | null;
  /** "public" or "friends" (mutual follows only), as on their profile. */
  profileVisibility: string;
  /** As of `asOf`: the viewer follows them... */
  viewerFollows: boolean;
  /** ...and they follow the viewer. */
  followsViewer: boolean;
  /** Explicit friendship, independent of either follow direction. */
  isFriend?: boolean;
  /** When they joined, to know a newcomer. */
  joinedAt?: Date | null;
}

/** One row a tab may show: a post, or somebody's repost of one. */
export interface FeedCandidate {
  id: string;
  /** Who put the row in the feed: the poster, or the member who reposted. */
  authorId: string;
  /** The post the card shows: the original for a repost, else the row itself. */
  contentId: string;
  contentAuthorId: string;
  /** The row's own time: a repost reaches the feed when it is made. */
  createdAt: Date;
  /** When the post the card shows was made: the original's time for a repost. */
  contentCreatedAt?: Date;
}

export interface Engagement {
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
}

/** One of the viewer's own interactions with a post, by its author. */
export interface Interaction {
  postId: string;
  authorId: string;
  kind: InteractionKind;
}

/** How much of a post's pull is left after its age: half of it every `halfLifeHours`. */
export function freshness(createdAt: Date, asOf: Date, halfLifeHours: number): number {
  const hours = Math.max(0, asOf.getTime() - createdAt.getTime()) / HOUR_MS;
  return 0.5 ** (hours / halfLifeHours);
}

/** Likes, comments, reposts and shares as one number, each by its weight. */
export function engagementCount(e: Engagement | undefined): number {
  if (!e) return 0;
  const w = ENGAGEMENT_WEIGHTS;
  return e.likes * w.likes + e.comments * w.comments + e.reposts * w.reposts + e.shares * w.shares;
}

/**
 * Engagement per its age: reactions slowed by `velocityHours`, so 10 reactions
 * in 6 hours count as 5, and 30 over two days count about 3.
 */
export function velocity(count: number, createdAt: Date, asOf: Date): number {
  const hours = Math.max(0, asOf.getTime() - createdAt.getTime()) / HOUR_MS;
  return count / (1 + hours / FOR_YOU.velocityHours);
}

/** Joined within NEWCOMER_DAYS of `asOf`. */
export function isNewcomer(author: FeedAuthor | undefined, asOf: Date): boolean {
  const joined = author?.joinedAt;
  if (!joined) return false;
  const age = asOf.getTime() - joined.getTime();
  return age >= 0 && age <= NEWCOMER_DAYS * DAY_MS;
}

/** "A": how much the viewer has interacted with each author's posts, capped. */
export function affinityByAuthor(interactions: readonly Interaction[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const i of interactions) {
    sums.set(i.authorId, (sums.get(i.authorId) ?? 0) + INTERACTION_WEIGHTS[i.kind]);
  }
  return new Map([...sums].map(([author, a]) => [author, Math.min(a, FOR_YOU.affinityCap)]));
}

/** Posts the viewer liked, commented on, saved or reposted. A share is not a reaction to the card. */
export function reactedTo(interactions: readonly Interaction[]): Set<string> {
  return new Set(interactions.filter((i) => i.kind !== "share").map((i) => i.postId));
}

/** An author's kinks and looking-for may count: their profile is public, or the two are friends. */
export function kinksReadable(author: FeedAuthor): boolean {
  return author.profileVisibility === "public" || author.isFriend === true;
}

/** What the ranking may read of an author. Roles are on every card, so they always count. */
export function readableKinks(author: FeedAuthor): KinkProfile {
  const readable = kinksReadable(author);
  return {
    roles: author.roles,
    kinks: readable ? author.kinks : [],
    lookingFor: readable ? author.lookingFor : [],
  };
}

/**
 * "Things I like": the kinks of the authors the viewer interacts with, each
 * weighted by how much (A), the strongest first. Ties go alphabetically so
 * the list never wobbles.
 */
export function learnedKinks(
  affinity: ReadonlyMap<string, number>,
  authors: ReadonlyMap<string, FeedAuthor>,
  top: number = FOR_YOU.learnedKinks,
): string[] {
  const weights = new Map<string, number>();
  for (const [authorId, a] of affinity) {
    const author = authors.get(authorId);
    if (!author) continue;
    for (const kink of new Set(readableKinks(author).kinks)) {
      weights.set(kink, (weights.get(kink) ?? 0) + a);
    }
  }
  return [...weights]
    .sort(([a, wa], [b, wb]) => wb - wa || a.localeCompare(b))
    .slice(0, top)
    .map(([kink]) => kink);
}

/**
 * How close an author is: the same city (and state), else the same state,
 * else the same country. States and cities only count within one country, so
 * a town of the same name across a border is not "near".
 */
export function placeTier(viewer: Place, author: Place): "city" | "state" | "country" | null {
  const sameCountry = samePlace(viewer.country, author.country);
  if (viewer.country && author.country && !sameCountry) return null;
  const sameState = samePlace(viewer.state, author.state);
  if (sameState && samePlace(viewer.city, author.city)) return "city";
  if (sameState) return "state";
  return sameCountry ? "country" : null;
}

const byTier = (
  tier: ReturnType<typeof placeTier>,
  w: { sameCity: number; sameState: number; sameCountry: number },
) => (tier === "city" ? w.sameCity : tier === "state" ? w.sameState : tier ? w.sameCountry : 0);

/** For You's score of one row, part by part: easier to test, and to explain an order. */
export interface ForYouParts {
  follows: number;
  affinity: number;
  kinks: number;
  gender: number;
  learned: number;
  engagement: number;
  place: number;
  newcomer: number;
  /** 1 plus every part above. */
  relevance: number;
  freshness: number;
  /** 0.35 for a post the viewer already reacted to, else 1. */
  reacted: number;
  score: number;
}

export interface ForYouSignals {
  viewer: FeedViewer;
  asOf: Date;
  /** Everyone a candidate's row or card names, and the authors the viewer interacted with. */
  authors: ReadonlyMap<string, FeedAuthor>;
  /** By content id. */
  engagement: ReadonlyMap<string, Engagement>;
  /** The viewer's own, over the interaction window. */
  interactions: readonly Interaction[];
}

/** Scores For You candidates against one viewer's signals; what can be worked out once, is. */
export function forYouScorer(s: ForYouSignals): (c: FeedCandidate) => ForYouParts {
  const affinity = affinityByAuthor(s.interactions);
  const reacted = reactedTo(s.interactions);
  const learned = new Set(learnedKinks(affinity, s.authors));
  // The viewer's own sexuality, else their gender: "All" lifts nobody.
  const shown = genderShown(defaultShow(s.viewer.gender, s.viewer.orientation));
  return (c) => {
    const poster = s.authors.get(c.authorId);
    const author = s.authors.get(c.contentAuthorId);
    // A friend counts as a follow both ways, followed or not.
    const follows = poster?.isFriend
      ? FOR_YOU.follows + FOR_YOU.followsBack
      : poster?.viewerFollows
        ? FOR_YOU.follows + (poster.followsViewer ? FOR_YOU.followsBack : 0)
        : 0;
    const affinityPart = FOR_YOU.affinity * Math.log1p(affinity.get(c.contentAuthorId) ?? 0);
    const readable = author ? readableKinks(author) : null;
    const k = readable ? kinkParts(s.viewer, readable) : null;
    const kinks = k
      ? Math.max(0, FOR_YOU.kinkScale * (k.side + k.pairs + k.kinks + k.lookingFor))
      : 0;
    const gender =
      shown && author && canonicalGender(author.gender) === shown ? FOR_YOU.genderShown : 0;
    const overlap = readable ? new Set(readable.kinks.filter((kink) => learned.has(kink))).size : 0;
    const learnedPart = Math.min(overlap * FOR_YOU.learnedKink, FOR_YOU.learnedKinkCap);
    const engagement =
      FOR_YOU.engagement *
      Math.log1p(
        velocity(
          engagementCount(s.engagement.get(c.contentId)),
          c.contentCreatedAt ?? c.createdAt,
          s.asOf,
        ),
      );
    const place = author ? byTier(placeTier(s.viewer, author), FOR_YOU) : 0;
    const newcomer = isNewcomer(author, s.asOf) ? FOR_YOU.newcomer : 0;
    const relevance =
      FOR_YOU.base +
      follows +
      affinityPart +
      kinks +
      gender +
      learnedPart +
      engagement +
      place +
      newcomer;
    const fresh = freshness(c.createdAt, s.asOf, FOR_YOU.halfLifeHours);
    const reactedPart = reacted.has(c.contentId) ? FOR_YOU.alreadyReacted : 1;
    return {
      follows,
      affinity: affinityPart,
      kinks,
      gender,
      learned: learnedPart,
      engagement,
      place,
      newcomer,
      relevance,
      freshness: fresh,
      reacted: reactedPart,
      score: relevance * fresh * reactedPart,
    };
  };
}

export function rankForYou(
  s: ForYouSignals & { candidates: readonly FeedCandidate[] },
): FeedCandidate[] {
  const score = forYouScorer(s);
  const ordered = arrange(
    s.candidates.map((candidate) => ({ candidate, score: score(candidate).score })),
  );
  const lifted = withNewcomerSlot(ordered, (c) => {
    const author = s.authors.get(c.contentAuthorId);
    if (!isNewcomer(author, s.asOf) || !author) return null;
    const tier = placeTier(s.viewer, author);
    return tier === "city" || tier === "state" ? 0 : tier === "country" ? 1 : null;
  });
  // Taking a row out can join two runs of one member's rows: spread them again.
  return spreadAuthors(lifted, (c) => c.authorId);
}

/**
 * A newcomer near the viewer gets seen: the best-ranked post by a member in
 * their first week, from the viewer's state (else country), moves up to
 * `newcomerSlot` when it ranked lower. `nearness` is 0 for the same state or
 * city, 1 for the same country, null for anyone else.
 */
export function withNewcomerSlot(
  ordered: readonly FeedCandidate[],
  nearness: (c: FeedCandidate) => 0 | 1 | null,
  slot: number = FOR_YOU.newcomerSlot,
): FeedCandidate[] {
  let pick = -1;
  for (const tier of [0, 1] as const) {
    pick = ordered.findIndex((c) => nearness(c) === tier);
    if (pick >= 0) break;
  }
  if (pick <= slot) return [...ordered];
  const out = [...ordered];
  const [row] = out.splice(pick, 1);
  out.splice(slot, 0, row);
  return out;
}

/** Nearby's score: how close, times how fresh, nudged by engagement. */
export function nearbyScore(
  viewer: Place,
  author: Place | undefined,
  c: FeedCandidate,
  engagement: Engagement | undefined,
  asOf: Date,
): number {
  // Everyone in the pool shares the viewer's state; their own city counts double.
  const proximity =
    author && placeTier(viewer, author) === "city" ? NEARBY.sameCity : NEARBY.sameState;
  return (
    proximity *
    freshness(c.createdAt, asOf, NEARBY.halfLifeHours) *
    (1 + NEARBY.engagement * Math.log1p(engagementCount(engagement)))
  );
}

export function rankNearby(s: {
  viewer: Place;
  asOf: Date;
  candidates: readonly FeedCandidate[];
  authors: ReadonlyMap<string, Place>;
  engagement: ReadonlyMap<string, Engagement>;
}): FeedCandidate[] {
  return arrange(
    s.candidates.map((candidate) => ({
      candidate,
      score: nearbyScore(
        s.viewer,
        s.authors.get(candidate.contentAuthorId),
        candidate,
        s.engagement.get(candidate.contentId),
        s.asOf,
      ),
    })),
  );
}

interface Scored {
  candidate: FeedCandidate;
  score: number;
}

/** Highest score first; ties to the newer row, then the larger id, as the database pages. */
function byScore(a: Scored, b: Scored): number {
  return (
    b.score - a.score ||
    b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime() ||
    (a.candidate.id < b.candidate.id ? 1 : a.candidate.id > b.candidate.id ? -1 : 0)
  );
}

/**
 * The final order: best first, one row per post (an original and its reposts
 * are one card's worth, so only the best-scoring row stays), and never more
 * than MAX_RUN rows in a row from one member.
 */
export function arrange(scored: readonly Scored[]): FeedCandidate[] {
  const kept = new Set<string>();
  const unique: FeedCandidate[] = [];
  for (const { candidate } of [...scored].sort(byScore)) {
    if (kept.has(candidate.contentId)) continue;
    kept.add(candidate.contentId);
    unique.push(candidate);
  }
  return spreadAuthors(unique, (c) => c.authorId);
}

/**
 * Greedy and deterministic: walks the list in order, and when the last
 * `maxRun` rows are one member's, takes the best row by anyone else next.
 * With nobody else left, the rest stay as they are.
 */
export function spreadAuthors<T>(
  items: readonly T[],
  authorOf: (item: T) => string,
  maxRun: number = MAX_RUN,
): T[] {
  const rest = [...items];
  const out: T[] = [];
  let runAuthor: string | null = null;
  let runLength = 0;
  while (rest.length) {
    let next = 0;
    if (runLength >= maxRun) {
      const other = rest.findIndex((item) => authorOf(item) !== runAuthor);
      if (other >= 0) next = other;
    }
    const [item] = rest.splice(next, 1);
    const author = authorOf(item);
    runLength = author === runAuthor ? runLength + 1 : 1;
    runAuthor = author;
    out.push(item);
  }
  return out;
}

// ---- cursor -----------------------------------------------------------------

const base = {
  v: z.literal(1),
  tab: z.enum(RANKED_TABS),
  /** The moment the list was ranked at, in epoch ms. */
  asOf: z.number().int().positive(),
};

const cursorSchema = z.discriminatedUnion("at", [
  /** Inside the ranked list: the next page starts at `offset`. */
  z.object({
    ...base,
    at: z.literal("ranked"),
    offset: z.number().int().min(0).max(MAX_RANKED),
  }),
  /**
   * Past it, newest first: posts before `before` (a null id means at or before
   * `t`). A cursor from before the pools (with a `skip`) still reads: unknown
   * keys are dropped.
   */
  z.object({
    ...base,
    at: z.literal("older"),
    before: z.object({ t: z.number().int().nonnegative(), id: z.string().uuid().nullable() }),
  }),
]);

export type FeedCursor = z.infer<typeof cursorSchema>;
/** A post's place in newest-first order: its time, and its id for posts made in the same instant. */
export interface FeedKey {
  t: number;
  id: string;
}
export type OlderBound = Extract<FeedCursor, { at: "older" }>["before"];

/** Opaque to the app: base64url JSON, versioned so its shape can change. */
export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/** Null for anything that isn't this tab's cursor: the caller starts from the top instead. */
export function decodeFeedCursor(
  raw: string | null | undefined,
  tab: RankedTab,
): FeedCursor | null {
  if (!raw) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString()));
    return parsed.success && parsed.data.tab === tab ? parsed.data : null;
  } catch {
    return null;
  }
}
