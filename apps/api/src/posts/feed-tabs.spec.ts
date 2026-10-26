import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, type SQL, type Table } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { WINDOWS, decodeFeedCursor, encodeFeedCursor, type FeedCursor } from "./feed-ranking";
import { followingConditions, followsAnyone, forgetFeedMemory, rankedTabPage } from "./feed-tabs";

/** One query as the code built it: there is no database in CI, so the SQL itself is checked. */
interface Query {
  fields: Record<string, unknown>;
  from?: Table;
  where?: SQL;
  orderBy?: SQL[];
  limit?: number;
  groupBy?: unknown[];
  unions: Query[];
}

/**
 * A db whose every query is recorded and answered by `respond`, which reads
 * what was asked rather than the order it was asked in.
 */
function fakeDb(respond: (q: Query) => unknown[]) {
  const queries: Query[] = [];
  const queryOf = new WeakMap<object, Query>();
  const select = vi.fn((fields: Record<string, unknown>) => {
    const q: Query = { fields, unions: [] };
    queries.push(q);
    const chain: object = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve()
                .then(() => respond(q))
                .then(res, rej);
          }
          return (...args: unknown[]) => {
            if (prop === "from") q.from = args[0] as Table;
            if (prop === "where") q.where = args[0] as SQL;
            if (prop === "orderBy") q.orderBy = args as SQL[];
            if (prop === "limit") q.limit = args[0] as number;
            if (prop === "groupBy") q.groupBy = args;
            if (prop === "unionAll") q.unions.push(queryOf.get(args[0] as object) as Query);
            return chain;
          };
        },
      },
    );
    queryOf.set(chain, q);
    return chain;
  });
  return { db: { select } as never, queries };
}

const render = (s: SQL) => new PgDialect().sqlToQuery(s);
const table = (q: Query) => (q.from ? getTableName(q.from) : null);

const NOW = new Date("2026-10-14T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const ID = (n: number) => `0f1c8b1e-1111-4111-8111-${String(n).padStart(12, "0")}`;
const iso = (d: Date) => d.toISOString();

const me = {
  gender: "Male",
  orientation: "Straight",
  roles: [],
  kinks: [],
  lookingFor: [],
  city: "Ikeja",
  state: "Lagos",
  country: "NG",
};

const row = (n: number, authorId: string, h: number, over: Record<string, unknown> = {}) => ({
  id: ID(n),
  authorId,
  repostOfId: null,
  originalAuthorId: null,
  createdAt: hoursAgo(h),
  ...over,
});

const person = (userId: string, over: Record<string, unknown> = {}) => ({
  userId,
  gender: null,
  roles: [],
  kinks: [],
  lookingFor: [],
  city: null,
  state: null,
  country: null,
  profileVisibility: "public",
  viewerFollows: false,
  followsViewer: false,
  ...over,
});

const isViewer = (q: Query) => table(q) === "profile" && "orientation" in q.fields;
const isAuthors = (q: Query) => table(q) === "profile" && "profileVisibility" in q.fields;
const isRows = (q: Query) => table(q) === "post" && "originalAuthorId" in q.fields;
/** What's taking off: likes and comments grouped by post, with the author's country. */
const isHot = (q: Query) => Boolean(q.groupBy) && "country" in q.fields;

type Pool =
  "recent" | "followed" | "friends" | "near" | "trending" | "interacted" | "newcomers" | "older";

/** Which of For You's pools (or the older posts past them) a row query is. */
function poolOf(q: Query): Pool {
  if (q.limit === WINDOWS.recentLimit) return "recent";
  if (q.limit === WINDOWS.followedLimit) return "followed";
  if (q.limit === WINDOWS.newcomerLimit) return "newcomers";
  if (q.limit !== 200) return "older";
  const { sql } = render(q.where!);
  if (sql.includes('"post"."id" in (')) return "trending";
  if (sql.includes('"post"."author_id" in (')) return "interacted";
  if (sql.includes('"profile"."state" = $')) return "near";
  return "friends";
}
const poolsOf = (db: ReturnType<typeof fakeDb>) =>
  Object.fromEntries(db.queries.filter(isRows).map((q) => [poolOf(q), q]));

/**
 * For You's world: ada (followed, follows back) posted p2, p4 and, eight days
 * ago, p5; bea and cal are strangers with p1 and p3. Ranked: ada's two fresh
 * posts, then the strangers (two of ada's in a row is the most), then p5.
 */
const recent = [row(1, "bea", 1), row(2, "ada", 2), row(3, "cal", 3), row(4, "ada", 4)];
const followed = [row(2, "ada", 2), row(4, "ada", 4), row(5, "ada", 200)];
const RANKED = [ID(2), ID(4), ID(1), ID(3), ID(5)];

interface World {
  older?: unknown[];
  viewer?: unknown;
  pools?: Partial<Record<Pool, unknown[]>>;
  hot?: unknown[];
  interactions?: unknown[];
}

function forYouDb({
  older = [],
  viewer = me,
  pools = {},
  hot = [],
  interactions = [],
}: World = {}) {
  const answers: Partial<Record<Pool, unknown[]>> = { recent, followed, older, ...pools };
  return fakeDb((q) => {
    if (isViewer(q)) return viewer ? [viewer] : [];
    if (isAuthors(q))
      return [
        person("ada", { viewerFollows: true, followsViewer: true }),
        person("bea"),
        person("cal"),
      ];
    if (isRows(q)) return answers[poolOf(q)] ?? [];
    if (isHot(q)) return table(q) === "post_like" ? hot : [];
    if (q.unions.length) return interactions;
    return [];
  });
}

const page = async (
  db: ReturnType<typeof fakeDb>,
  cursor: string | null,
  limit = 2,
  tab: "for_you" | "nearby" = "for_you",
) => rankedTabPage(db.db, "me", tab, cursor, limit, NOW);

const cursorOf = (raw: string | null) => decodeFeedCursor(raw, "for_you");

beforeEach(forgetFeedMemory);

describe("For You's pages", () => {
  it("ranks the first page as of now, and pages through the same list, kept in memory", async () => {
    const db = forYouDb();
    const first = await page(db, null);
    expect(first.ids).toEqual(RANKED.slice(0, 2));
    expect(cursorOf(first.nextCursor)).toEqual({
      v: 1,
      tab: "for_you",
      asOf: NOW.getTime(),
      at: "ranked",
      offset: 2,
    });

    const again = forYouDb();
    const second = await page(again, first.nextCursor);
    expect(second.ids).toEqual(RANKED.slice(2, 4));
    expect(cursorOf(second.nextCursor)).toMatchObject({ at: "ranked", offset: 4 });
    // The viewer, and nothing else: the list was ranked once.
    expect(again.queries.filter((q) => !isViewer(q))).toEqual([]);
  });

  it("ranks the same list again where it isn't remembered (another instance, or later)", async () => {
    const first = await page(forYouDb(), null);
    forgetFeedMemory();
    const db = forYouDb();
    const second = await page(db, first.nextCursor);
    expect(second.ids).toEqual(RANKED.slice(2, 4));
    expect(db.queries.filter(isRows).length).toBeGreaterThan(0);
  });

  it("reads every later page as of the first page's moment, not now", async () => {
    const then = hoursAgo(3);
    const cursor = encodeFeedCursor({
      v: 1,
      tab: "for_you",
      asOf: then.getTime(),
      at: "ranked",
      offset: 2,
    });
    const db = forYouDb({ hot: [{ postId: ID(1), country: "NG", n: 3 }] });
    const result = await page(db, cursor);
    const pools = db.queries.filter(isRows);
    expect(pools.map(poolOf).sort()).toEqual([
      "followed",
      "friends",
      "near",
      "newcomers",
      "recent",
      "trending",
    ]);
    for (const q of [...pools, ...db.queries.filter(isHot)]) {
      const { params } = render(q.where!);
      expect(params).not.toContain(iso(NOW));
    }
    for (const q of pools) expect(render(q.where!).params).toContain(iso(then));
    // Counted up to then, too: a like since then can't move a post between pages.
    expect(cursorOf(result.nextCursor)?.asOf).toBe(then.getTime());
  });

  it("reads a week of everyone's posts and a month of followed members', newest first", async () => {
    const db = forYouDb();
    await page(db, null);
    const { recent: recentPool, followed: followedPool } = poolsOf(db);
    expect(recentPool.limit).toBe(300);
    expect(followedPool.limit).toBe(400);
    const r = render(recentPool.where!);
    expect(r.params).toContain(iso(hoursAgo(7 * 24)));
    expect(r.sql).toContain('"post"."created_at" > $');
    const f = render(followedPool.where!);
    expect(f.params).toContain(iso(hoursAgo(30 * 24)));
    // Followed as of the moment ranked at: a follow made mid-scroll waits for the next first page.
    expect(f.sql).toMatch(
      /exists \(select 1 from "follow" where "follow"\."follower_id" = \$\d+ and "follow"\."following_id" = "post"\."author_id" and "follow"\."created_at"::timestamptz <= \$\d+::timestamptz\)/,
    );
    expect(recentPool.orderBy?.map((o) => render(o).sql)).toEqual([
      '"post"."created_at" desc',
      '"post"."id" desc',
    ]);
  });

  it("adds a month of friends' posts, two weeks of the viewer's state and a week of newcomers in their country", async () => {
    const db = forYouDb();
    await page(db, null);
    const { friends, near, newcomers } = poolsOf(db);

    const fr = render(friends.where!);
    expect(friends.limit).toBe(200);
    expect(fr.params).toContain(iso(hoursAgo(30 * 24)));
    expect(fr.sql).toMatch(
      /exists \(select 1 from "friendship" where "friendship"\."status" = 'accepted' and \(\("friendship"\."user_a" = \$\d+ and "friendship"\."user_b" = "post"\."author_id"\)/,
    );

    const n = render(near.where!);
    expect(near.limit).toBe(200);
    expect(n.params).toContain(iso(hoursAgo(14 * 24)));
    expect(n.sql).toContain('"profile"."state" = $');
    expect(n.params).toEqual(expect.arrayContaining(["Lagos", "NG", "location"]));

    const nc = render(newcomers.where!);
    expect(newcomers.limit).toBe(60);
    expect(nc.params).toContain(iso(hoursAgo(7 * 24)));
    // Joined in the last 7 days...
    expect(nc.sql).toMatch(
      /exists \(select 1 from "user" where "user"\."id" = "post"\."author_id" and "user"\."created_at"::timestamptz > \$\d+::timestamptz\)/,
    );
    // ...in the viewer's country, where their location is readable to the viewer.
    expect(nc.sql).toContain('"profile"."country" = $');
    expect(nc.params).toEqual(expect.arrayContaining(["NG", "location"]));
  });

  it("leaves out the state's pool without a state and the newcomers' without a country", async () => {
    const db = forYouDb({ viewer: { ...me, state: null, country: null } });
    await page(db, null);
    expect(Object.keys(poolsOf(db)).sort()).toEqual(["followed", "friends", "recent"]);
  });

  it("adds what's taking off in the viewer's country, read once for every viewer", async () => {
    const hot = [
      { postId: ID(30), country: "NG", n: 4 },
      { postId: ID(31), country: "GH", n: 9 },
      { postId: ID(32), country: "NG", n: 7 },
    ];
    const db = forYouDb({ hot });
    await page(db, null);
    const likes = db.queries.find((q) => isHot(q) && table(q) === "post_like")!;
    const comments = db.queries.find((q) => isHot(q) && table(q) === "post_comment")!;
    // Three days of likes and comments, up to the start of this five minutes.
    for (const q of [likes, comments]) {
      expect(render(q.where!).params).toEqual(
        expect.arrayContaining([iso(hoursAgo(3 * 24)), iso(NOW)]),
      );
      expect(q.limit).toBe(5000);
    }
    expect(render(comments.where!).sql).toContain('"post_comment"."deleted_at" is null');

    const { trending } = poolsOf(db);
    const t = render(trending.where!);
    // Hottest first, Ghana's left out, and through the location privacy of each author.
    expect(t.params).toEqual(expect.arrayContaining([ID(32), ID(30)]));
    expect(t.params).not.toContain(ID(31));
    expect(t.params).toEqual(expect.arrayContaining(["NG", "location"]));

    // Another viewer in the same five minutes: no second read of what's trending.
    const other = forYouDb({ hot });
    await rankedTabPage(other.db, "you", "for_you", null, 2, new Date(NOW.getTime() + 60_000));
    expect(other.queries.filter(isHot)).toEqual([]);
    expect(poolsOf(other).trending).toBeDefined();
  });

  it("adds the recent posts of the 50 authors the viewer interacts with most", async () => {
    const interactions = [
      { postId: "p", authorId: "dee", kind: "comment" },
      { postId: "q", authorId: "eve", kind: "like" },
    ];
    const db = forYouDb({ interactions });
    await page(db, null);
    const { interacted } = poolsOf(db);
    const i = render(interacted.where!);
    expect(interacted.limit).toBe(200);
    expect(i.params).toContain(iso(hoursAgo(30 * 24)));
    expect(i.sql).toContain('"post"."author_id" in ($');
    expect(i.params).toEqual(expect.arrayContaining(["dee", "eve"]));
  });

  it("goes through the visibility rule, leaving out the viewer's own posts and both sides of a block", async () => {
    const db = forYouDb({
      hot: [{ postId: ID(30), country: "NG", n: 4 }],
      interactions: [{ postId: "p", authorId: "dee", kind: "like" }],
    });
    await page(db, null);
    const pools = db.queries.filter(isRows);
    expect(pools).toHaveLength(7);
    for (const q of pools) {
      const { sql, params } = render(q.where!);
      expect(sql).toContain('"post"."deleted_at" is null');
      expect(sql).toContain('"post"."visibility" = $');
      expect(sql).toContain('from "friendship"');
      expect(sql).toContain('"friendship"."status" = \'accepted\'');
      expect(sql).toContain('not exists (select 1 from "member_ban"');
      expect(sql).toContain('"post"."author_id" <> $');
      expect(sql).toContain(
        'not exists (select 1 from "member_block" where "member_block"."blocker_id" = "post"."author_id"',
      );
      expect(sql).toContain(
        'not exists (select 1 from "member_block" where "member_block"."blocker_id" = $',
      );
      expect(sql).toContain('"post"."created_at" <= $');
      // A repost only of a live, public, readable post that isn't the viewer's.
      expect(sql).toContain('"post"."repost_of_id" is null or');
      expect(sql).toContain('"feed_original"."visibility" = $');
      expect(sql).toContain('"feed_original"."author_id" <> $');
      expect(sql).toContain('"member_block"."blocked_id" = "feed_original"."author_id"');
      expect(params).toContain("me");
      expect(params).toContain(iso(NOW));
    }
  });

  it("learns from the viewer's own likes, saves, shares, comments and reposts of the last 60 days", async () => {
    const db = forYouDb();
    await page(db, null);
    const [interactions] = db.queries.filter((q) => q.unions.length);
    const parts = [interactions, ...interactions.unions];
    expect(parts.map(table)).toEqual([
      "post_like",
      "post_save",
      "post_share",
      "post_comment",
      "post",
    ]);
    for (const part of parts) {
      const { sql, params } = render(part.where!);
      expect(params).toEqual(expect.arrayContaining(["me", iso(hoursAgo(60 * 24)), iso(NOW)]));
      // Their own posts teach nothing.
      expect(sql).toContain('"interacted_post"."author_id" <> $');
    }
    expect(render(parts[3].where!).sql).toContain('"post_comment"."deleted_at" is null');
    expect(render(parts[4].where!).sql).toContain('"post"."deleted_at" is null');
  });

  it("counts engagement and reads the authors for every candidate at once, never anyone's sexuality", async () => {
    const db = forYouDb();
    await page(db, null);
    const counts = db.queries.filter((q) => q.groupBy && !isHot(q));
    expect(counts.map(table)).toEqual(["post_like", "post_comment", "post", "post_share"]);
    for (const q of counts) expect(render(q.where!).params).toContain(iso(NOW));
    const [authors] = db.queries.filter(isAuthors);
    expect(Object.keys(authors.fields)).not.toContain("orientation");
    // When they joined, to know a newcomer.
    expect(Object.keys(authors.fields)).toContain("joinedAt");
    expect(render(authors.where!).params).toEqual(expect.arrayContaining(["ada", "bea", "cal"]));
    // Only the viewer's own profile carries a sexuality.
    expect(db.queries.filter((q) => "orientation" in q.fields)).toHaveLength(1);
  });

  it("fills the page with older posts when the ranked list runs out, then carries on newest first", async () => {
    const olderRows = [row(10, "cal", 300), row(11, "bea", 320)];
    const db = forYouDb({ older: olderRows });
    const last = encodeFeedCursor({
      v: 1,
      tab: "for_you",
      asOf: NOW.getTime(),
      at: "ranked",
      offset: 4,
    });
    const result = await page(db, last);
    expect(result.ids).toEqual([ID(5), ID(10)]);
    expect(cursorOf(result.nextCursor)).toEqual({
      v: 1,
      tab: "for_you",
      asOf: NOW.getTime(),
      at: "older",
      before: { t: hoursAgo(300).getTime(), id: ID(10) },
    });

    const older = db.queries.filter(isRows).find((q) => q.limit === 2)!;
    const { sql, params } = render(older.where!);
    // Older than the week's oldest post in the ranked list...
    expect(sql).toContain('("post"."created_at", "post"."id") < ($');
    expect(params).toEqual(expect.arrayContaining([iso(hoursAgo(4)), ID(4)]));
    // ...less the rows ranked from further back: the followed month's p5.
    expect(sql).toContain('"post"."id" not in ($');
    expect(params).toEqual(expect.arrayContaining([ID(5)]));
  });

  it("reads on from an older-posts cursor, leaving out what the ranked list had, and stops at the end", async () => {
    const cursor: FeedCursor = {
      v: 1,
      tab: "for_you",
      asOf: NOW.getTime(),
      at: "older",
      before: { t: hoursAgo(150).getTime(), id: ID(9) },
    };
    const more = forYouDb({
      older: [row(11, "bea", 160), row(12, "cal", 330), row(13, "cal", 340)],
    });
    const next = await page(more, encodeFeedCursor(cursor));
    expect(next.ids).toEqual([ID(11), ID(12)]);
    expect(cursorOf(next.nextCursor)).toMatchObject({
      at: "older",
      before: { t: hoursAgo(330).getTime(), id: ID(12) },
    });
    // Nothing remembered: the list is ranked again to know what it had. p5, 200 hours old.
    const older = more.queries.filter(isRows).find((q) => poolOf(q) === "older")!;
    const { sql, params } = render(older.where!);
    expect(sql).toContain('"post"."id" not in ($');
    expect(params).toContain(ID(5));
    expect(params).not.toContain(ID(4));

    // Remembered now: the viewer, then one read of older posts.
    const warm = forYouDb({ older: [row(11, "bea", 160)] });
    const end = await page(warm, encodeFeedCursor(cursor));
    expect(end).toEqual({ ids: [ID(11)], nextCursor: null });
    expect(
      warm.queries.map((q) => (isViewer(q) ? "viewer" : isRows(q) ? q.limit : "other")),
    ).toEqual(["viewer", 3]);
  });

  it("starts older posts at the window's floor when nobody posted all week", async () => {
    const db = forYouDb({ pools: { recent: [], followed: [] }, older: [row(20, "cal", 500)] });
    const result = await page(db, null);
    expect(result).toEqual({ ids: [ID(20)], nextCursor: null });
    const older = db.queries.filter(isRows).find((q) => q.limit === 3)!;
    expect(render(older.where!).sql).toContain('"post"."created_at" <= $');
    expect(render(older.where!).params).toContain(iso(hoursAgo(7 * 24)));
    // Nothing was ranked, so nothing to leave out.
    expect(render(older.where!).sql).not.toContain("not in");
  });

  it("reads the first page for a cursor it can't use", async () => {
    for (const bad of [
      "garbage",
      encodeFeedCursor({ v: 1, tab: "nearby", asOf: 5, at: "ranked", offset: 2 }),
    ]) {
      const result = await page(forYouDb(), bad);
      expect(result.ids).toEqual(RANKED.slice(0, 2));
      expect(cursorOf(result.nextCursor)).toMatchObject({ asOf: NOW.getTime(), offset: 2 });
    }
  });
});

describe("Nearby's pages", () => {
  const nearbyDb = (viewer: unknown, pool: unknown[] = [], older: unknown[] = []) =>
    fakeDb((q) => {
      if (isViewer(q)) return [viewer];
      if (isAuthors(q))
        return [
          person("ada", { city: "Ikeja", state: "Lagos", country: "NG" }),
          person("cal", { city: "Lekki", state: "Lagos", country: "NG" }),
        ];
      if (isRows(q)) return q.limit === 800 ? pool : older;
      return [];
    });

  it("asks for a location, reading nothing else, when the viewer has no state", async () => {
    const db = nearbyDb({ ...me, state: null });
    expect(await page(db, null, 2, "nearby")).toEqual({
      ids: [],
      nextCursor: null,
      hint: "no_location",
    });
    expect(db.queries).toHaveLength(1);
  });

  it("ranks the viewer's own city first, then reads on with older posts from the state", async () => {
    const db = nearbyDb(
      me,
      [row(1, "cal", 1), row(2, "ada", 3)],
      [row(3, "cal", 400), row(4, "ada", 420)],
    );
    const result = await page(db, null, 3, "nearby");
    expect(result.ids).toEqual([ID(2), ID(1), ID(3)]);
    expect(decodeFeedCursor(result.nextCursor, "nearby")).toMatchObject({
      at: "older",
      before: { t: hoursAgo(400).getTime(), id: ID(3) },
    });
    const [pool, older] = db.queries.filter(isRows);
    for (const q of [pool, older]) {
      const { sql, params } = render(q.where!);
      // Original posts by members in the viewer's state, within their country; no gender filter.
      expect(sql).toContain('"post"."repost_of_id" is null');
      expect(sql).toContain(
        'exists (select 1 from "profile" where "profile"."user_id" = "post"."author_id" and (',
      );
      expect(sql).toContain('"profile"."state" = $');
      expect(params).toContain("location");
      expect(sql).toContain('"profile"."country" = $');
      expect(params).toEqual(expect.arrayContaining(["Lagos", "NG"]));
      expect(sql).not.toContain('"profile"."gender" =');
    }
    expect(pool.limit).toBe(800);
    expect(render(pool.where!).params).toContain(iso(hoursAgo(14 * 24)));
  });

  it("reads its older pages without ranking again: its one pool ends where they begin", async () => {
    const db = nearbyDb(me, [], [row(3, "cal", 400)]);
    const cursor = encodeFeedCursor({
      v: 1,
      tab: "nearby",
      asOf: NOW.getTime(),
      at: "older",
      before: { t: hoursAgo(300).getTime(), id: ID(9) },
    });
    expect(await page(db, cursor, 2, "nearby")).toEqual({ ids: [ID(3)], nextCursor: null });
    expect(db.queries.map((q) => (isViewer(q) ? "viewer" : q.limit))).toEqual(["viewer", 3]);
  });

  it("looks in the viewer's state alone when they have no country", async () => {
    const db = nearbyDb({ ...me, country: null }, []);
    await page(db, null, 2, "nearby");
    const [pool] = db.queries.filter(isRows);
    const { sql, params } = render(pool.where!);
    expect(sql).toContain('"profile"."state" = $');
    expect(params).toContain("Lagos");
    expect(sql).not.toContain('"profile"."country" = $');
  });
});

describe("Following", () => {
  it("is the viewer's own posts and the posts and reposts of everyone they follow, with no block either way", () => {
    const { sql, params } = render(followingConditions("me")[0]);
    expect(sql).toBe(
      '("post"."author_id" = $1 or exists (select 1 from "follow" where "follow"."follower_id" = $2 and "follow"."following_id" = "post"."author_id"))',
    );
    expect(params).toEqual(["me", "me"]);
    const block = render(followingConditions("me")[1]);
    expect(block.sql).toContain('"member_block"."blocker_id" = "post"."author_id"');
    expect(block.sql).toContain('"member_block"."blocked_id" = "post"."author_id"');
    // A followed member's repost of a blocked or suspended member's post stays out.
    const repost = render(followingConditions("me")[2]);
    expect(repost.sql).toContain(
      '("post"."repost_of_id" is null or exists (select 1 from "post" "feed_original" where "feed_original"."id" = "post"."repost_of_id"',
    );
    expect(repost.sql).toContain('"member_ban"."user_id" = "feed_original"."author_id"');
    expect(repost.sql).toContain('"member_block"."blocked_id" = "feed_original"."author_id"');
  });

  it("knows whether the viewer follows anyone, from one row at most", async () => {
    const some = fakeDb((q) => (table(q) === "follow" ? [{ id: "ada" }] : []));
    expect(await followsAnyone(some.db, "me")).toBe(true);
    expect(some.queries[0].limit).toBe(1);
    expect(render(some.queries[0].where!)).toMatchObject({
      sql: '"follow"."follower_id" = $1',
      params: ["me"],
    });
    expect(await followsAnyone(fakeDb(() => []).db, "me")).toBe(false);
  });
});
