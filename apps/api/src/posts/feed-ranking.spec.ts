import { describe, expect, it } from "vitest";
import {
  FOR_YOU,
  MAX_RUN,
  affinityByAuthor,
  arrange,
  decodeFeedCursor,
  encodeFeedCursor,
  engagementCount,
  forYouScorer,
  freshness,
  kinksReadable,
  learnedKinks,
  nearbyScore,
  placeTier,
  rankForYou,
  rankNearby,
  reactedTo,
  readableKinks,
  spreadAuthors,
  type FeedAuthor,
  type FeedCandidate,
  type FeedCursor,
  type FeedViewer,
  type ForYouSignals,
  type Interaction,
} from "./feed-ranking";

const asOf = new Date("2026-10-14T12:00:00Z");
const hoursAgo = (h: number) => new Date(asOf.getTime() - h * 3_600_000);
const ID = (n: number) => `0f1c8b1e-1111-4111-8111-${String(n).padStart(12, "0")}`;

const viewer = (over: Partial<FeedViewer> = {}): FeedViewer => ({
  gender: null,
  orientation: null,
  roles: [],
  kinks: [],
  lookingFor: [],
  city: null,
  state: null,
  country: null,
  ...over,
});

const author = (userId: string, over: Partial<FeedAuthor> = {}): FeedAuthor => ({
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

const post = (id: string, authorId: string, over: Partial<FeedCandidate> = {}): FeedCandidate => ({
  id,
  authorId,
  contentId: id,
  contentAuthorId: authorId,
  createdAt: hoursAgo(1),
  ...over,
});

const signals = (over: Partial<ForYouSignals> = {}): ForYouSignals => ({
  viewer: viewer(),
  asOf,
  authors: new Map(),
  engagement: new Map(),
  interactions: [],
  ...over,
});

const authors = (...list: FeedAuthor[]) => new Map(list.map((a) => [a.userId, a]));
const did = (kind: Interaction["kind"], authorId: string, postId = "x"): Interaction => ({
  kind,
  authorId,
  postId,
});

describe("freshness", () => {
  it("halves a post's pull every half-life", () => {
    expect(freshness(asOf, asOf, 36)).toBe(1);
    expect(freshness(hoursAgo(36), asOf, 36)).toBeCloseTo(0.5);
    expect(freshness(hoursAgo(72), asOf, 36)).toBeCloseTo(0.25);
    expect(freshness(hoursAgo(24), asOf, 24)).toBeCloseTo(0.5);
  });

  it("never rewards a post stamped after the moment ranked at", () => {
    expect(freshness(new Date(asOf.getTime() + 3_600_000), asOf, 36)).toBe(1);
  });
});

describe("engagement", () => {
  it("weighs likes 1, comments 2, reposts 3 and shares 2", () => {
    expect(engagementCount({ likes: 4, comments: 1, reposts: 1, shares: 1 })).toBe(11);
    expect(engagementCount(undefined)).toBe(0);
  });
});

describe("affinity: the viewer's interactions with an author's posts", () => {
  it("counts a like 1, a save 2, a share 2, a comment 3 and a repost 3", () => {
    const a = affinityByAuthor([
      did("like", "ada"),
      did("save", "ada"),
      did("share", "ada"),
      did("comment", "ada"),
      did("repost", "ada"),
      did("like", "bea"),
    ]);
    expect(a.get("ada")).toBe(11);
    expect(a.get("bea")).toBe(1);
  });

  it("caps A at 30, however much the viewer interacts", () => {
    const many = Array.from({ length: 50 }, () => did("comment", "ada"));
    expect(affinityByAuthor(many).get("ada")).toBe(FOR_YOU.affinityCap);
  });

  it("scores 2.5 × ln(1 + A)", () => {
    const score = forYouScorer(
      signals({ interactions: [did("comment", "ada")], authors: authors(author("ada")) }),
    );
    expect(score(post("p1", "ada")).affinity).toBeCloseTo(2.5 * Math.log(4));
    expect(score(post("p2", "bea")).affinity).toBe(0);
  });
});

describe("what the viewer already reacted to", () => {
  it("is a like, comment, save or repost; a share is not a reaction to the card", () => {
    const reacted = reactedTo([
      did("like", "a", "p1"),
      did("comment", "a", "p2"),
      did("save", "a", "p3"),
      did("repost", "a", "p4"),
      did("share", "a", "p5"),
    ]);
    expect([...reacted].sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("keeps 0.35 of a post's score once reacted to, wherever its row came from", () => {
    const score = forYouScorer(signals({ interactions: [did("like", "ada", "p1")] }));
    expect(score(post("p1", "ada")).reacted).toBe(FOR_YOU.alreadyReacted);
    // A repost of p1 shows p1: the reaction counts there too.
    expect(score(post("r1", "bea", { contentId: "p1", contentAuthorId: "ada" })).reacted).toBe(
      0.35,
    );
    expect(score(post("p2", "ada")).reacted).toBe(1);
  });
});

describe("privacy: an author's kinks and looking-for", () => {
  it("are read from a public profile", () => {
    expect(kinksReadable(author("a"))).toBe(true);
  });

  it("are read from a friends-only profile only for accepted friends", () => {
    const friendsOnly = { profileVisibility: "friends", kinks: ["Latex"], lookingFor: ["Events"] };
    expect(kinksReadable(author("a", friendsOnly))).toBe(false);
    expect(kinksReadable(author("a", { ...friendsOnly, viewerFollows: true }))).toBe(false);
    expect(kinksReadable(author("a", { ...friendsOnly, followsViewer: true }))).toBe(false);
    expect(
      kinksReadable(author("a", { ...friendsOnly, viewerFollows: true, followsViewer: true })),
    ).toBe(false);
    expect(kinksReadable(author("a", { ...friendsOnly, isFriend: true }))).toBe(true);
    // Roles are on every card, so they always count.
    expect(readableKinks(author("a", { ...friendsOnly, roles: ["Brat"] }))).toEqual({
      roles: ["Brat"],
      kinks: [],
      lookingFor: [],
    });
  });

  it("leave a friends-only stranger's kinks out of the score", () => {
    const me = viewer({ kinks: ["Latex"], lookingFor: ["Events"] });
    const open = author("a", { kinks: ["Latex"], lookingFor: ["Events"] });
    const closed = author("b", { ...open, userId: "b", profileVisibility: "friends" });
    const score = forYouScorer(signals({ viewer: me, authors: authors(open, closed) }));
    expect(score(post("p1", "a")).kinks).toBeCloseTo(0.4 * 2);
    expect(score(post("p2", "b")).kinks).toBe(0);
  });
});

describe("learned kinks: the things the viewer likes", () => {
  it("are the kinks of the authors interacted with, weighted by A, five at most", () => {
    const a = new Map([
      ["ada", 6],
      ["bea", 2],
    ]);
    const learned = learnedKinks(
      a,
      authors(
        author("ada", { kinks: ["Latex", "Bondage", "Wax", "Gags", "Rope", "Feet"] }),
        author("bea", { kinks: ["Latex", "Spanking"] }),
      ),
    );
    // Latex 8; then the 6s alphabetically; Spanking (2) misses the cut.
    expect(learned).toEqual(["Latex", "Bondage", "Feet", "Gags", "Rope"]);
  });

  it("never learn from a friends-only stranger's kinks", () => {
    const learned = learnedKinks(
      new Map([["ada", 9]]),
      authors(author("ada", { kinks: ["Latex"], profileVisibility: "friends" })),
    );
    expect(learned).toEqual([]);
  });

  it("add +0.5 per overlap with the candidate author's kinks, up to +2.5", () => {
    const learnedFrom = author("ada", { kinks: ["Latex", "Bondage", "Wax", "Gags", "Rope"] });
    const score = forYouScorer(
      signals({
        interactions: [did("comment", "ada")],
        authors: authors(
          learnedFrom,
          author("bea", { kinks: ["Latex", "Bondage"] }),
          author("cal", { kinks: ["Latex", "Bondage", "Wax", "Gags", "Rope", "Feet"] }),
        ),
      }),
    );
    expect(score(post("p1", "bea")).learned).toBe(1);
    expect(score(post("p2", "cal")).learned).toBe(FOR_YOU.learnedKinkCap);
  });
});

describe("kink match (matching v1's kink parts)", () => {
  it("scales role side, pairs, shared kinks and looking-for by 0.4", () => {
    const me = viewer({ roles: ["Dominant"], kinks: ["Bondage"], lookingFor: ["Friendship"] });
    const sub = author("a", {
      roles: ["Submissive"],
      kinks: ["Bondage"],
      lookingFor: ["Friendship"],
    });
    const score = forYouScorer(signals({ viewer: me, authors: authors(sub) }));
    // side 4 + pairs 2 + kinks 1 + looking-for 1, no place, presence or photo.
    expect(score(post("p1", "a")).kinks).toBeCloseTo(0.4 * 8);
  });

  it("is floored at 0: a dom shown another dom loses nothing", () => {
    const score = forYouScorer(
      signals({
        viewer: viewer({ roles: ["Dominant"] }),
        authors: authors(author("a", { roles: ["Dominant"] })),
      }),
    );
    expect(score(post("p1", "a")).kinks).toBe(0);
  });
});

describe("gender: who the viewer is shown by default", () => {
  const women = author("w", { gender: "female" });
  const men = author("m", { gender: "Male" });
  const parts = (me: FeedViewer) => {
    const score = forYouScorer(signals({ viewer: me, authors: authors(women, men) }));
    return [score(post("p1", "w")).gender, score(post("p2", "m")).gender];
  };

  it("lifts the gender the viewer's own sexuality shows them, +3", () => {
    expect(parts(viewer({ gender: "Male", orientation: "Straight" }))).toEqual([3, 0]);
    expect(parts(viewer({ gender: "Female", orientation: null }))).toEqual([0, 3]);
  });

  it("lifts nobody for a viewer shown everyone", () => {
    expect(parts(viewer({ gender: "Male", orientation: "Bisexual" }))).toEqual([0, 0]);
    expect(parts(viewer())).toEqual([0, 0]);
  });
});

describe("place", () => {
  it("is the same city (and state), else the same state, else the same country", () => {
    const me = { city: "Ikeja", state: "Lagos", country: "NG" };
    expect(placeTier(me, { city: "ikeja ", state: "LAGOS", country: "NG" })).toBe("city");
    expect(placeTier(me, { city: "Lekki", state: "Lagos", country: "NG" })).toBe("state");
    expect(placeTier(me, { city: "Ikeja", state: "Ogun", country: "NG" })).toBe("country");
    expect(placeTier(me, { city: null, state: null, country: "KE" })).toBeNull();
    expect(placeTier(me, { city: null, state: null, country: null })).toBeNull();
  });

  it("never matches a state of the same name across a border", () => {
    const me = { city: null, state: "Lagos", country: "NG" };
    expect(placeTier(me, { city: null, state: "Lagos", country: "KE" })).toBeNull();
    // With a country unknown on one side, the state still counts.
    expect(placeTier({ ...me, country: null }, { city: null, state: "Lagos", country: "NG" })).toBe(
      "state",
    );
  });

  it("adds a mild +2, +1.5 or +1 to For You", () => {
    const me = viewer({ city: "Ikeja", state: "Lagos", country: "NG" });
    const score = forYouScorer(
      signals({
        viewer: me,
        authors: authors(
          author("a", { city: "Ikeja", state: "Lagos", country: "NG" }),
          author("b", { state: "Lagos", country: "NG" }),
          author("c", { country: "NG" }),
          author("d", { country: "KE" }),
        ),
      }),
    );
    expect(["a", "b", "c", "d"].map((a, i) => score(post(`p${i}`, a)).place)).toEqual([
      2, 1.5, 1, 0,
    ]);
  });
});

describe("For You's score", () => {
  it("gives +6 for following the author, +2 more when they follow back", () => {
    const score = forYouScorer(
      signals({
        authors: authors(
          author("one", { viewerFollows: true }),
          author("two", { viewerFollows: true, followsViewer: true }),
          author("fan", { followsViewer: true }),
        ),
      }),
    );
    expect(score(post("p1", "one")).follows).toBe(6);
    expect(score(post("p2", "two")).follows).toBe(8);
    expect(score(post("p3", "fan")).follows).toBe(0);
  });

  it("follows whoever put a repost in the feed; the card's author decides everything else", () => {
    const score = forYouScorer(
      signals({
        viewer: viewer({ gender: "Male", orientation: "Straight" }),
        authors: authors(
          author("friend", { viewerFollows: true, gender: "Male" }),
          author("stranger", { gender: "Female" }),
        ),
      }),
    );
    const repost = post("r1", "friend", { contentId: "p1", contentAuthorId: "stranger" });
    expect(score(repost)).toMatchObject({ follows: 6, gender: 3 });
  });

  it("counts engagement as 1.2 × ln(1 + likes + 2·comments + 3·reposts + 2·shares)", () => {
    const engagement = new Map([["p1", { likes: 3, comments: 1, reposts: 1, shares: 1 }]]);
    const score = forYouScorer(signals({ engagement }));
    expect(score(post("p1", "a")).engagement).toBeCloseTo(1.2 * Math.log(1 + 10));
    // A repost's row counts the post it shows.
    expect(score(post("r1", "b", { contentId: "p1" })).engagement).toBeCloseTo(1.2 * Math.log(11));
  });

  it("multiplies relevance by freshness and the reacted factor", () => {
    const score = forYouScorer(
      signals({
        authors: authors(author("a", { viewerFollows: true })),
        interactions: [did("like", "z", "p1")],
      }),
    );
    const parts = score(post("p1", "a", { createdAt: hoursAgo(36) }));
    expect(parts.relevance).toBe(1 + 6);
    expect(parts.freshness).toBeCloseTo(0.5);
    expect(parts.score).toBeCloseTo(7 * 0.5 * 0.35);
  });

  it("lets a followed member's post outrank a stranger's for about four days, then decay below it", () => {
    // 7 × 0.5^(t/36) passes a fresh stranger's 1 until t ≈ 101 hours.
    const ranked = rankForYou({
      ...signals({
        authors: authors(author("friend", { viewerFollows: true }), author("stranger")),
      }),
      candidates: [
        post("five-days", "friend", { createdAt: hoursAgo(120) }),
        post("three-days", "friend", { createdAt: hoursAgo(72) }),
        post("stranger", "stranger", { createdAt: hoursAgo(1) }),
        post("fresh", "friend", { createdAt: hoursAgo(2) }),
      ],
    });
    expect(ranked.map((c) => c.id)).toEqual(["fresh", "three-days", "stranger", "five-days"]);
  });

  it("is the same order however the candidates arrive", () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      post(ID(i), `a${i % 3}`, { createdAt: hoursAgo(i % 4) }),
    );
    const s = signals({ authors: authors(author("a0", { viewerFollows: true })) });
    const once = rankForYou({ ...s, candidates }).map((c) => c.id);
    const again = rankForYou({ ...s, candidates: [...candidates].reverse() }).map((c) => c.id);
    expect(again).toEqual(once);
  });
});

describe("one row per post", () => {
  it("keeps only the best-scoring of an original and its reposts", () => {
    const original = post("p1", "stranger", { createdAt: hoursAgo(40) });
    const repost = post("r1", "friend", {
      contentId: "p1",
      contentAuthorId: "stranger",
      createdAt: hoursAgo(1),
    });
    const ranked = arrange([
      { candidate: original, score: 1 },
      { candidate: repost, score: 5 },
      { candidate: post("p2", "x"), score: 3 },
    ]);
    expect(ranked.map((c) => c.id)).toEqual(["r1", "p2"]);
  });

  it("breaks a tie by the newer row, then the larger id", () => {
    const ranked = arrange([
      { candidate: post(ID(1), "a", { createdAt: hoursAgo(2) }), score: 1 },
      { candidate: post(ID(2), "b", { createdAt: hoursAgo(1) }), score: 1 },
      { candidate: post(ID(3), "c", { createdAt: hoursAgo(2) }), score: 1 },
    ]);
    expect(ranked.map((c) => c.id)).toEqual([ID(2), ID(3), ID(1)]);
  });
});

describe("diversity", () => {
  const ids = (list: { id: string }[]) => list.map((c) => c.id).join(" ");

  it("never puts more than two posts in a row from one member", () => {
    const list = ["a1", "a2", "a3", "a4", "b1", "a5", "c1"].map((id) => post(id, id[0]));
    expect(MAX_RUN).toBe(2);
    expect(ids(spreadAuthors(list, (c) => c.authorId))).toBe("a1 a2 b1 a3 a4 c1 a5");
  });

  it("brings forward the best post by anyone else, keeping everyone's own order", () => {
    const list = ["a1", "a2", "a3", "b1", "b2", "b3", "c1"].map((id) => post(id, id[0]));
    expect(ids(spreadAuthors(list, (c) => c.authorId))).toBe("a1 a2 b1 a3 b2 b3 c1");
  });

  it("leaves the rest as it is when only one member is left", () => {
    const list = ["b1", "a1", "a2", "a3", "a4"].map((id) => post(id, id[0]));
    expect(ids(spreadAuthors(list, (c) => c.authorId))).toBe("b1 a1 a2 a3 a4");
  });

  it("counts a repost as its reposter's: a run of reposts by one member is broken up", () => {
    const reposts = ["r1", "r2", "r3"].map((id, i) =>
      post(id, "ada", { contentId: `p${i}`, contentAuthorId: `author${i}` }),
    );
    const ranked = arrange([
      ...reposts.map((candidate, i) => ({ candidate, score: 10 - i })),
      { candidate: post("b1", "bea"), score: 1 },
    ]);
    expect(ids(ranked)).toBe("r1 r2 b1 r3");
  });
});

describe("Nearby's score", () => {
  const me = { city: "Ikeja", state: "Lagos", country: "NG" };

  it("is closeness (own city 2, rest of the state 1) × a 24-hour half-life × an engagement nudge", () => {
    const at = (h: number) => post("p", "a", { createdAt: hoursAgo(h) });
    expect(
      nearbyScore(me, { city: "Ikeja", state: "Lagos", country: "NG" }, at(0), undefined, asOf),
    ).toBe(2);
    expect(
      nearbyScore(me, { city: null, state: "Lagos", country: "NG" }, at(24), undefined, asOf),
    ).toBeCloseTo(0.5);
    expect(
      nearbyScore(me, { city: "Lekki", state: "Lagos", country: "NG" }, at(0), undefined, asOf),
    ).toBe(1);
    const busy = { likes: 9, comments: 0, reposts: 0, shares: 0 };
    expect(
      nearbyScore(me, { city: "Lekki", state: "Lagos", country: "NG" }, at(0), busy, asOf),
    ).toBeCloseTo(1 + 0.15 * Math.log(10));
  });

  it("ranks the viewer's own city first, then fresher posts, without any gender filter", () => {
    const ranked = rankNearby({
      viewer: me,
      asOf,
      candidates: [
        post("surulere", "cal", { createdAt: hoursAgo(30) }),
        post("ikeja", "ada", { createdAt: hoursAgo(10) }),
        post("lekki", "dee", { createdAt: hoursAgo(1) }),
      ],
      authors: new Map([
        ["ada", { city: "Ikeja", state: "Lagos", country: "NG" }],
        ["cal", { city: "Surulere", state: "Lagos", country: "NG" }],
        ["dee", { city: "Lekki", state: "Lagos", country: "NG" }],
      ]),
      engagement: new Map(),
    });
    expect(ranked.map((c) => c.id)).toEqual(["ikeja", "lekki", "surulere"]);
  });
});

describe("the cursor", () => {
  const ranked: FeedCursor = {
    v: 1,
    tab: "for_you",
    asOf: asOf.getTime(),
    at: "ranked",
    offset: 20,
  };
  const older: FeedCursor = {
    v: 1,
    tab: "nearby",
    asOf: asOf.getTime(),
    at: "older",
    before: { t: hoursAgo(400).getTime(), id: ID(7) },
    skip: null,
  };

  it("round-trips, opaque to the app", () => {
    const raw = encodeFeedCursor(ranked);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeFeedCursor(raw, "for_you")).toEqual(ranked);
    expect(decodeFeedCursor(encodeFeedCursor(older), "nearby")).toEqual(older);
    const fromTheFloor = { ...older, before: { t: 5, id: null }, skip: { t: 9, id: ID(1) } };
    expect(decodeFeedCursor(encodeFeedCursor(fromTheFloor), "nearby")).toEqual(fromTheFloor);
  });

  it("is nothing (the first page) when it isn't this tab's cursor", () => {
    const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    for (const raw of [
      null,
      undefined,
      "",
      "not a cursor",
      "2026-09-18T10:00:00.000Z",
      Buffer.from("{oops").toString("base64url"),
      b64({ ...ranked, v: 2 }),
      b64({ ...ranked, offset: -1 }),
      b64({ ...ranked, offset: 1.5 }),
      b64({ ...ranked, asOf: "yesterday" }),
      b64({ ...older, tab: "nearby", before: { t: 1, id: "not-a-uuid" } }),
      b64({ ...ranked, at: "sideways" }),
      b64([]),
    ]) {
      expect(decodeFeedCursor(raw, "for_you")).toBeNull();
    }
    // Another tab's cursor starts this tab from the top.
    expect(decodeFeedCursor(encodeFeedCursor(ranked), "nearby")).toBeNull();
  });
});
