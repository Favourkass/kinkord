import { privacyAllows, privateProfileValue } from "../privacy/privacy-policy";
import { acceptedFriendship } from "../members/friendship-policy";
/**
 * The home feed's tabs, read from the database (docs/MATCHING.md, "Feed").
 *
 * Following reads newest first like the feed always has: PostsService adds
 * `followingConditions` to its own query. For You and Nearby rank a window of
 * recent posts as it stood at `asOf` (feed-ranking.ts), page through it by
 * offset, then carry on newest first with older posts through the same cursor,
 * so the feed never runs dry early. Every query here goes through the one
 * visibility rule and leaves out both sides of a block.
 *
 * A handful of set-based queries per ranked list, never one per post: the
 * viewer, the candidate pools, the viewer's interactions, then grouped counts
 * and the authors for every candidate at once. The list is kept in memory for
 * the pages after the first, and what's trending is shared by every viewer.
 */
import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/db.module";
import {
  follow,
  post,
  postComment,
  postLike,
  postSave,
  postShare,
  profile,
  user,
} from "../db/schema";
import { notBanned } from "../moderation/admins";
import { noBlockEitherWay } from "../safety/blocks";
import {
  DAY_MS,
  ENGAGEMENT_WEIGHTS,
  NEWCOMER_DAYS,
  WINDOWS,
  affinityByAuthor,
  decodeFeedCursor,
  encodeFeedCursor,
  rankForYou,
  rankNearby,
  type Engagement,
  type FeedAuthor,
  type FeedCandidate,
  type FeedCursor,
  type FeedHint,
  type FeedKey,
  type FeedViewer,
  type Interaction,
  type InteractionKind,
  type OlderBound,
  type Place,
  type RankedTab,
} from "./feed-ranking";
import { visibleTo } from "./visibility";

/** A page of a ranked tab: which rows, in order, for PostsService to read and decorate. */
export interface TabPage {
  ids: string[];
  nextCursor: string | null;
  hint?: FeedHint;
}

const ORIGINAL = "feed_original";
/** A repost's original, joined (or looked up) beside the repost row. */
const original = alias(post, ORIGINAL);

/** A repost's original as every tab shows it: live, public, not suspended, no block either way. */
function originalReadable(viewerId: string) {
  return and(
    isNull(original.deletedAt),
    isNull(original.archivedAt),
    eq(original.visibility, "public"),
    notBanned(original.authorId),
    privacyAllows(viewerId, original.authorId, "posts"),
    privacyAllows(viewerId, original.authorId, "sharedContent"),
    noBlockEitherWay(original.authorId, viewerId),
  );
}

/**
 * Following: posts and reposts by members the viewer follows, and their own,
 * whatever country anyone is in. Neither side of a block, nor a repost of a
 * blocked or suspended member's post.
 */
export function followingConditions(viewerId: string): SQL[] {
  return [
    or(
      eq(post.authorId, viewerId),
      sql`exists (select 1 from ${follow} where ${follow.followerId} = ${viewerId} and ${follow.followingId} = ${post.authorId})`,
    )!,
    noBlockEitherWay(post.authorId, viewerId),
    sql`(${post.repostOfId} is null or exists (select 1 from ${post} ${sql.identifier(ORIGINAL)} where ${original.id} = ${post.repostOfId} and ${originalReadable(viewerId)}))`,
  ];
}

/** Whether the viewer follows anyone: an empty Following says how to fill it when they don't. */
export async function followsAnyone(db: Db, viewerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: follow.followingId })
    .from(follow)
    .where(eq(follow.followerId, viewerId))
    .limit(1);
  return Boolean(row);
}

/**
 * The follow existed at `asOf`. A follow made since, from a card mid-scroll,
 * waits for the next first page instead of reshuffling this one.
 * (`follow.created_at` is wall time in the session's zone, read back as such.)
 */
function followedAsOf(follower: string | AnyColumn, following: string | AnyColumn, asOf: Date) {
  return sql<boolean>`exists (select 1 from ${follow} where ${follow.followerId} = ${follower} and ${follow.followingId} = ${following} and ${follow.createdAt}::timestamptz <= ${asOf.toISOString()}::timestamptz)`;
}

const daysBefore = (asOf: Date, days: number) => new Date(asOf.getTime() - days * DAY_MS);

/** Rows newer than nothing in `before`: older by time, or at the same time with a smaller id. */
function olderThan(before: OlderBound): SQL {
  const at = new Date(before.t).toISOString();
  return before.id
    ? sql`(${post.createdAt}, ${post.id}) < (${at}::timestamptz, ${before.id}::uuid)`
    : sql`${post.createdAt} <= ${at}::timestamptz`;
}

/**
 * Nearby: original posts by members in the viewer's state, within their
 * country when they have one, so a state of the same name across a border
 * isn't "near".
 */
function nearbyConditions(viewer: Place, viewerId: string): SQL[] {
  const place = and(
    privacyAllows(viewerId, profile.userId, "location"),
    eq(profile.state, viewer.state ?? ""),
    ...(viewer.country ? [eq(profile.country, viewer.country)] : []),
  );
  return [
    isNull(post.repostOfId),
    sql`exists (select 1 from ${profile} where ${profile.userId} = ${post.authorId} and ${place})`,
  ];
}

/**
 * Posts by members in the viewer's country, where their location is readable
 * to the viewer. Nothing to narrow by when the viewer has no country.
 */
function countryConditions(viewer: Place, viewerId: string): SQL[] {
  if (!viewer.country) return [];
  const place = and(
    privacyAllows(viewerId, profile.userId, "location"),
    eq(profile.country, viewer.country),
  );
  return [
    sql`exists (select 1 from ${profile} where ${profile.userId} = ${post.authorId} and ${place})`,
  ];
}

/** Posts by members who joined after `floor` (`user.created_at` is wall time, as `follow`'s). */
function joinedSince(floor: Date): SQL {
  return sql`exists (select 1 from ${user} where ${user.id} = ${post.authorId} and ${user.createdAt}::timestamptz > ${floor.toISOString()}::timestamptz)`;
}

interface Row {
  id: string;
  authorId: string;
  repostOfId: string | null;
  originalAuthorId: string | null;
  originalCreatedAt: Date | null;
  createdAt: Date;
}

/**
 * The rows a ranked tab may show, newest first: visible to the viewer, made by
 * `asOf`, never the viewer's own (those are in Following), nobody on either
 * side of a block, and a repost only of a readable post that isn't theirs.
 */
function postRows(
  db: Db,
  viewerId: string,
  asOf: Date,
  extra: SQL[],
  limit: number,
): Promise<Row[]> {
  const viewerFollows = alias(follow, "viewer_follows_author");
  const authorFollows = alias(follow, "author_follows_viewer");
  return db
    .select({
      id: post.id,
      authorId: post.authorId,
      repostOfId: post.repostOfId,
      originalAuthorId: original.authorId,
      originalCreatedAt: original.createdAt,
      createdAt: post.createdAt,
    })
    .from(post)
    .leftJoin(original, eq(original.id, post.repostOfId))
    .leftJoin(
      viewerFollows,
      and(eq(viewerFollows.followerId, viewerId), eq(viewerFollows.followingId, post.authorId)),
    )
    .leftJoin(
      authorFollows,
      and(eq(authorFollows.followerId, post.authorId), eq(authorFollows.followingId, viewerId)),
    )
    .where(
      and(
        and(isNull(post.deletedAt), isNull(post.archivedAt)),
        visibleTo(viewerId, viewerFollows, authorFollows),
        lte(post.createdAt, asOf),
        ne(post.authorId, viewerId),
        noBlockEitherWay(post.authorId, viewerId),
        or(
          isNull(post.repostOfId),
          and(ne(original.authorId, viewerId), originalReadable(viewerId)),
        ),
        ...extra,
      ),
    )
    .orderBy(desc(post.createdAt), desc(post.id))
    .limit(limit);
}

const toCandidate = (r: Row): FeedCandidate => ({
  id: r.id,
  authorId: r.authorId,
  contentId: r.repostOfId ?? r.id,
  contentAuthorId: r.originalAuthorId ?? r.authorId,
  createdAt: r.createdAt,
  contentCreatedAt: r.originalCreatedAt ?? r.createdAt,
});

/** The oldest row of a newest-first pool. */
const oldest = (rows: Row[]): FeedKey | null => {
  const last = rows.at(-1);
  return last ? { t: last.createdAt.getTime(), id: last.id } : null;
};

const NO_PROFILE: FeedViewer = {
  gender: null,
  orientation: null,
  roles: [],
  kinks: [],
  lookingFor: [],
  city: null,
  state: null,
  country: null,
};

/** The viewer's own profile: the one sexuality the feed ever reads. */
async function readViewer(db: Db, viewerId: string): Promise<FeedViewer> {
  const [me] = await db
    .select({
      gender: profile.gender,
      orientation: profile.orientation,
      roles: profile.roles,
      kinks: profile.interests,
      lookingFor: profile.lookingFor,
      city: profile.city,
      state: profile.state,
      country: profile.country,
    })
    .from(profile)
    .where(eq(profile.userId, viewerId));
  if (!me) return NO_PROFILE;
  return { ...me, roles: me.roles ?? [], kinks: me.kinks ?? [], lookingFor: me.lookingFor ?? [] };
}

/**
 * The authors a window names, as of `asOf`: everything the ranking reads of
 * them, and never their sexuality.
 */
async function authorsOf(
  db: Db,
  viewerId: string,
  ids: string[],
  asOf: Date,
): Promise<Map<string, FeedAuthor>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({
      userId: profile.userId,
      gender: profile.gender,
      roles: profile.roles,
      kinks: privateProfileValue(viewerId, profile.userId, "interests", profile.interests),
      lookingFor: privateProfileValue(viewerId, profile.userId, "interests", profile.lookingFor),
      city: privateProfileValue(viewerId, profile.userId, "location", profile.city),
      state: privateProfileValue(viewerId, profile.userId, "location", profile.state),
      country: privateProfileValue(viewerId, profile.userId, "location", profile.country),
      profileVisibility: profile.profileVisibility,
      viewerFollows: followedAsOf(viewerId, profile.userId, asOf),
      followsViewer: followedAsOf(profile.userId, viewerId, asOf),
      isFriend: acceptedFriendship(viewerId, profile.userId),
      joinedAt: user.createdAt,
    })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(inArray(profile.userId, ids));
  return new Map(
    rows.map((r) => [
      r.userId,
      {
        ...r,
        roles: r.roles ?? [],
        kinks: r.kinks ?? [],
        lookingFor: r.lookingFor ?? [],
        viewerFollows: Boolean(r.viewerFollows),
        followsViewer: Boolean(r.followsViewer),
        isFriend: Boolean(r.isFriend),
      },
    ]),
  );
}

/** Likes, live comments, live reposts and shares of each post, counted up to `asOf`. */
async function engagementOf(db: Db, ids: string[], asOf: Date): Promise<Map<string, Engagement>> {
  if (!ids.length) return new Map();
  const [likes, comments, reposts, shares] = await Promise.all([
    db
      .select({ postId: postLike.postId, n: count() })
      .from(postLike)
      .where(and(inArray(postLike.postId, ids), lte(postLike.createdAt, asOf)))
      .groupBy(postLike.postId),
    db
      .select({ postId: postComment.postId, n: count() })
      .from(postComment)
      .where(
        and(
          inArray(postComment.postId, ids),
          isNull(postComment.deletedAt),
          lte(postComment.createdAt, asOf),
        ),
      )
      .groupBy(postComment.postId),
    db
      .select({ postId: post.repostOfId, n: count() })
      .from(post)
      .where(
        and(
          inArray(post.repostOfId, ids),
          and(isNull(post.deletedAt), isNull(post.archivedAt)),
          lte(post.createdAt, asOf),
        ),
      )
      .groupBy(post.repostOfId),
    db
      .select({ postId: postShare.postId, n: count() })
      .from(postShare)
      .where(and(inArray(postShare.postId, ids), lte(postShare.createdAt, asOf)))
      .groupBy(postShare.postId),
  ]);
  const out = new Map<string, Engagement>();
  const add = (rows: { postId: string | null; n: number }[], part: keyof Engagement) => {
    for (const r of rows) {
      if (!r.postId) continue;
      const e = out.get(r.postId) ?? { likes: 0, comments: 0, reposts: 0, shares: 0 };
      e[part] = Number(r.n);
      out.set(r.postId, e);
    }
  };
  add(likes, "likes");
  add(comments, "comments");
  add(reposts, "reposts");
  add(shares, "shares");
  return out;
}

/**
 * The viewer's own likes, saves, shares, comments and reposts over the
 * interaction window, up to `asOf`, each with the author of the post: what
 * "things I like" is learned from. One query; their own posts don't count.
 */
function interactionsOf(db: Db, viewerId: string, asOf: Date): Promise<Interaction[]> {
  const from = daysBefore(asOf, WINDOWS.interactionDays);
  const target = alias(post, "interacted_post");
  const within = (at: AnyColumn) => and(gt(at, from), lte(at, asOf));
  const notOwn = ne(target.authorId, viewerId);
  const of = (kind: InteractionKind) => sql<InteractionKind>`${sql.raw(`'${kind}'`)}`;
  const likes = db
    .select({ postId: target.id, authorId: target.authorId, kind: of("like") })
    .from(postLike)
    .innerJoin(target, eq(target.id, postLike.postId))
    .where(and(eq(postLike.userId, viewerId), within(postLike.createdAt), notOwn));
  const saves = db
    .select({ postId: target.id, authorId: target.authorId, kind: of("save") })
    .from(postSave)
    .innerJoin(target, eq(target.id, postSave.postId))
    .where(and(eq(postSave.userId, viewerId), within(postSave.createdAt), notOwn));
  const shares = db
    .select({ postId: target.id, authorId: target.authorId, kind: of("share") })
    .from(postShare)
    .innerJoin(target, eq(target.id, postShare.postId))
    .where(and(eq(postShare.userId, viewerId), within(postShare.createdAt), notOwn));
  const comments = db
    .select({ postId: target.id, authorId: target.authorId, kind: of("comment") })
    .from(postComment)
    .innerJoin(target, eq(target.id, postComment.postId))
    .where(
      and(
        eq(postComment.authorId, viewerId),
        isNull(postComment.deletedAt),
        within(postComment.createdAt),
        notOwn,
      ),
    );
  const reposts = db
    .select({ postId: target.id, authorId: target.authorId, kind: of("repost") })
    .from(post)
    .innerJoin(target, eq(target.id, post.repostOfId))
    .where(
      and(
        eq(post.authorId, viewerId),
        and(isNull(post.deletedAt), isNull(post.archivedAt)),
        within(post.createdAt),
        notOwn,
      ),
    );
  return likes.unionAll(saves).unionAll(shares).unionAll(comments).unionAll(reposts);
}

/**
 * A ranked tab's window: its order, where the older posts pick up after it,
 * and every row it ranked, which the older posts must not repeat (For You's
 * pools reach further back than the week's).
 */
interface RankedWindow {
  /** Row ids, best first. */
  ranked: string[];
  olderFrom: OlderBound;
  /** Every candidate row, shown or not. */
  rows: FeedKey[];
}

/** Where older posts start: just past a pool's oldest row, or at its time floor when it is empty. */
const olderFrom = (pool: Row[], floor: Date): OlderBound =>
  oldest(pool) ?? { t: floor.getTime(), id: null };

const windowOf = (rows: Row[], ranked: FeedCandidate[], from: OlderBound): RankedWindow => ({
  ranked: ranked.map((c) => c.id),
  olderFrom: from,
  rows: rows.map((r) => ({ t: r.createdAt.getTime(), id: r.id })),
});

/**
 * The window's rows that posts before `before` could repeat. A row the older
 * read returns is never newer than `before.t` (to the millisecond).
 */
const alreadyRanked = (window: RankedWindow, before: OlderBound): string[] =>
  window.rows.filter((k) => k.t <= before.t).map((k) => k.id);

/** A post taking off: its likes + 2 × comments in the trending window, and its author's country. */
interface Hot {
  postId: string;
  country: string | null;
  heat: number;
}

/** The trending window's posts, hottest first. Not per viewer: the visibility rule comes after. */
async function hottest(db: Db, at: Date): Promise<Hot[]> {
  const floor = daysBefore(at, WINDOWS.trendingDays);
  const live = and(isNull(post.deletedAt), isNull(post.archivedAt));
  const [likes, comments] = await Promise.all([
    db
      .select({ postId: postLike.postId, country: profile.country, n: count() })
      .from(postLike)
      .innerJoin(post, eq(post.id, postLike.postId))
      .innerJoin(profile, eq(profile.userId, post.authorId))
      .where(and(gt(postLike.createdAt, floor), lte(postLike.createdAt, at), live))
      .groupBy(postLike.postId, profile.country)
      .orderBy(desc(count()))
      .limit(TRENDING_SCAN),
    db
      .select({ postId: postComment.postId, country: profile.country, n: count() })
      .from(postComment)
      .innerJoin(post, eq(post.id, postComment.postId))
      .innerJoin(profile, eq(profile.userId, post.authorId))
      .where(
        and(
          gt(postComment.createdAt, floor),
          lte(postComment.createdAt, at),
          isNull(postComment.deletedAt),
          live,
        ),
      )
      .groupBy(postComment.postId, profile.country)
      .orderBy(desc(count()))
      .limit(TRENDING_SCAN),
  ]);
  const hot = new Map<string, Hot>();
  const add = (rows: Array<{ postId: string; country: string | null; n: number }>, w: number) => {
    for (const r of rows) {
      const h = hot.get(r.postId) ?? { postId: r.postId, country: r.country, heat: 0 };
      h.heat += Number(r.n) * w;
      hot.set(r.postId, h);
    }
  };
  add(likes, ENGAGEMENT_WEIGHTS.likes);
  add(comments, ENGAGEMENT_WEIGHTS.comments);
  return [...hot.values()].sort(
    (a, b) => b.heat - a.heat || (a.postId < b.postId ? -1 : a.postId > b.postId ? 1 : 0),
  );
}

/**
 * What's taking off is the same for every viewer, so it is read once per
 * bucket of time, as of the bucket's start, and shared: one read every few
 * minutes however many members open the app. Another instance reads the same.
 */
const TRENDING_BUCKET_MS = 5 * 60_000;
const TRENDING_BUCKETS_KEPT = 3;
/** The most posts a trending read counts, per kind: far more than any country's share. */
const TRENDING_SCAN = 5000;
const trending = new Map<number, Promise<Hot[]>>();

function trendingAt(db: Db, asOf: Date): Promise<Hot[]> {
  const bucket = asOf.getTime() - (asOf.getTime() % TRENDING_BUCKET_MS);
  const known = trending.get(bucket);
  if (known) return known;
  const read = hottest(db, new Date(bucket));
  // A failed read isn't kept: the next viewer reads again.
  read.catch(() => trending.delete(bucket));
  trending.set(bucket, read);
  while (trending.size > TRENDING_BUCKETS_KEPT) trending.delete(Math.min(...trending.keys()));
  return read;
}

/**
 * What's taking off in the viewer's country (everywhere, when they have
 * none), through the visibility rule and the authors' location privacy.
 */
async function trendingRows(
  db: Db,
  viewerId: string,
  viewer: FeedViewer,
  asOf: Date,
): Promise<Row[]> {
  const ids = (await trendingAt(db, asOf))
    .filter((h) => !viewer.country || h.country === viewer.country)
    .slice(0, WINDOWS.trendingLimit)
    .map((h) => h.postId);
  if (!ids.length) return [];
  return postRows(
    db,
    viewerId,
    asOf,
    [inArray(post.id, ids), ...countryConditions(viewer, viewerId)],
    WINDOWS.trendingLimit,
  );
}

async function forYouWindow(
  db: Db,
  viewerId: string,
  viewer: FeedViewer,
  asOf: Date,
): Promise<RankedWindow> {
  const recentFloor = daysBefore(asOf, WINDOWS.recentDays);
  const since = (days: number) => gt(post.createdAt, daysBefore(asOf, days));
  const none = Promise.resolve([] as Row[]);
  const [recent, followed, friends, near, hot, newcomers, interactions] = await Promise.all([
    postRows(db, viewerId, asOf, [gt(post.createdAt, recentFloor)], WINDOWS.recentLimit),
    postRows(
      db,
      viewerId,
      asOf,
      [since(WINDOWS.followedDays), followedAsOf(viewerId, post.authorId, asOf)],
      WINDOWS.followedLimit,
    ),
    postRows(
      db,
      viewerId,
      asOf,
      [since(WINDOWS.friendsDays), acceptedFriendship(viewerId, post.authorId)],
      WINDOWS.friendsLimit,
    ),
    viewer.state
      ? postRows(
          db,
          viewerId,
          asOf,
          [since(WINDOWS.nearPoolDays), ...nearbyConditions(viewer, viewerId)],
          WINDOWS.nearPoolLimit,
        )
      : none,
    trendingRows(db, viewerId, viewer, asOf),
    viewer.country
      ? postRows(
          db,
          viewerId,
          asOf,
          [
            since(WINDOWS.newcomerDays),
            joinedSince(daysBefore(asOf, NEWCOMER_DAYS)),
            ...countryConditions(viewer, viewerId),
          ],
          WINDOWS.newcomerLimit,
        )
      : none,
    interactionsOf(db, viewerId, asOf),
  ]);
  // The authors the viewer interacts with most: their recent posts are a pool of their own.
  const favourites = [...affinityByAuthor(interactions)]
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, WINDOWS.interactedAuthors)
    .map(([id]) => id);
  const interacted = favourites.length
    ? await postRows(
        db,
        viewerId,
        asOf,
        [since(WINDOWS.interactedDays), inArray(post.authorId, favourites)],
        WINDOWS.interactedLimit,
      )
    : [];
  const pools = [...recent, ...followed, ...friends, ...interacted, ...near, ...hot, ...newcomers];
  const rows = [...new Map(pools.map((r) => [r.id, r])).values()];
  const candidates = rows.map(toCandidate);
  const authorIds = new Set([
    ...candidates.flatMap((c) => [c.authorId, c.contentAuthorId]),
    ...interactions.map((i) => i.authorId),
  ]);
  const [engagement, authors] = await Promise.all([
    engagementOf(db, [...new Set(candidates.map((c) => c.contentId))], asOf),
    authorsOf(db, viewerId, [...authorIds], asOf),
  ]);
  return windowOf(
    rows,
    rankForYou({ viewer, asOf, candidates, authors, engagement, interactions }),
    olderFrom(recent, recentFloor),
  );
}

async function nearbyWindow(
  db: Db,
  viewerId: string,
  viewer: FeedViewer,
  asOf: Date,
): Promise<RankedWindow> {
  const floor = daysBefore(asOf, WINDOWS.nearbyDays);
  const pool = await postRows(
    db,
    viewerId,
    asOf,
    [gt(post.createdAt, floor), ...nearbyConditions(viewer, viewerId)],
    WINDOWS.nearbyLimit,
  );
  const candidates = pool.map(toCandidate);
  const [engagement, authors] = await Promise.all([
    engagementOf(
      db,
      candidates.map((c) => c.contentId),
      asOf,
    ),
    authorsOf(db, viewerId, [...new Set(candidates.map((c) => c.authorId))], asOf),
  ]);
  return windowOf(
    pool,
    rankNearby({ viewer, asOf, candidates, authors, engagement }),
    olderFrom(pool, floor),
  );
}

/** Past the ranked list, newest first, less the rows it already ranked. */
function olderRows(
  db: Db,
  viewerId: string,
  tab: RankedTab,
  viewer: FeedViewer,
  asOf: Date,
  before: OlderBound,
  ranked: string[],
  limit: number,
): Promise<Row[]> {
  return postRows(
    db,
    viewerId,
    asOf,
    [
      olderThan(before),
      ...(tab === "nearby" ? nearbyConditions(viewer, viewerId) : []),
      ...(ranked.length ? [notInArray(post.id, ranked)] : []),
    ],
    limit,
  );
}

/**
 * A ranked list depends only on the viewer and its moment (`asOf`), so it is
 * worked out once and later pages are read from memory, on this instance for
 * a while. Another instance works it out again and gets the same list.
 */
const WINDOW_CACHE_MS = 10 * 60_000;
const WINDOW_CACHE_MAX = 200;
const windows = new Map<string, { at: number; window: RankedWindow }>();

async function cachedWindow(
  key: string,
  build: () => Promise<RankedWindow>,
): Promise<RankedWindow> {
  const now = Date.now();
  const hit = windows.get(key);
  if (hit && now - hit.at < WINDOW_CACHE_MS) return hit.window;
  const window = await build();
  windows.delete(key);
  windows.set(key, { at: now, window });
  // Kept in the order they were made: drop stale ones, and the oldest beyond the cap.
  for (const [k, v] of windows) {
    if (windows.size <= WINDOW_CACHE_MAX && now - v.at < WINDOW_CACHE_MS) break;
    windows.delete(k);
  }
  return window;
}

/** For specs: start with nothing remembered, neither ranked lists nor what's trending. */
export function forgetFeedMemory(): void {
  windows.clear();
  trending.clear();
}

/**
 * One page of For You or Nearby. The first page ranks as of now; every later
 * page carries that moment in its cursor and reads the same list. An invalid
 * cursor reads the first page.
 */
export async function rankedTabPage(
  db: Db,
  viewerId: string,
  tab: RankedTab,
  rawCursor: string | null | undefined,
  limit: number,
  now = new Date(),
): Promise<TabPage> {
  const cursor = decodeFeedCursor(rawCursor, tab);
  const asOf = new Date(cursor?.asOf ?? now.getTime());
  const viewer = await readViewer(db, viewerId);
  if (tab === "nearby" && !viewer.state) {
    return { ids: [], nextCursor: null, hint: "no_location" };
  }
  const stamp = { v: 1, tab, asOf: asOf.getTime() } as const;
  const rankedWindow = () =>
    cachedWindow(`${tab}:${viewerId}:${asOf.getTime()}`, () =>
      tab === "for_you"
        ? forYouWindow(db, viewerId, viewer, asOf)
        : nearbyWindow(db, viewerId, viewer, asOf),
    );
  /** The cursor after `taken` of `rows` older posts, when there are more. */
  const nextOlder = (rows: Row[], taken: number, before: OlderBound) => {
    if (rows.length <= taken) return null;
    const next: FeedCursor = {
      ...stamp,
      at: "older",
      before: oldest(rows.slice(0, taken)) ?? before,
    };
    return encodeFeedCursor(next);
  };

  if (cursor?.at === "older") {
    // Nearby's one pool ends where its older posts begin; For You's other pools reach past it.
    const ranked = tab === "for_you" ? alreadyRanked(await rankedWindow(), cursor.before) : [];
    const rows = await olderRows(db, viewerId, tab, viewer, asOf, cursor.before, ranked, limit + 1);
    return {
      ids: rows.slice(0, limit).map((r) => r.id),
      nextCursor: nextOlder(rows, limit, cursor.before),
    };
  }

  const window = await rankedWindow();
  const offset = cursor?.offset ?? 0;
  const ranked = window.ranked.slice(offset, offset + limit);
  if (offset + limit < window.ranked.length) {
    return {
      ids: ranked,
      nextCursor: encodeFeedCursor({ ...stamp, at: "ranked", offset: offset + limit }),
    };
  }
  // The ranked list runs out on this page: older posts fill the rest of it.
  const room = limit - ranked.length;
  const older = await olderRows(
    db,
    viewerId,
    tab,
    viewer,
    asOf,
    window.olderFrom,
    alreadyRanked(window, window.olderFrom),
    room + 1,
  );
  return {
    ids: [...ranked, ...older.slice(0, room).map((r) => r.id)],
    nextCursor: nextOlder(older, room, window.olderFrom),
  };
}
