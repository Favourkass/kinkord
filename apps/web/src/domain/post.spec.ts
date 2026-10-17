import { describe, expect, it } from "vitest";
import {
  clampBody,
  handleOf,
  isFeedTab,
  needsClamp,
  POST_BODY_MAX,
  POST_PREVIEW_CHARS,
  postBodyMax,
  SILVER_POST_BODY_MAX,
  toCommentVM,
  toFeedSuggestionVM,
  toPostVM,
  type CommentPM,
  type FeedSuggestionPM,
  type PostPM,
} from "./post";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const href = (username: string | null) => (username ? `/u/${username}` : null);

const author = {
  userId: "u2",
  username: "tegamaxwell",
  displayName: "Sir T",
  avatarUrl: "https://s3.test/avatar.jpg",
};

const post = (over: Partial<PostPM> = {}): PostPM => ({
  id: "p1",
  postId: "p1",
  body: "Today something exciting happened",
  visibility: "public",
  createdAt: "2026-09-18T11:00:00.000Z",
  author,
  media: [],
  likes: 12500,
  comments: 300,
  reposts: 42,
  likedByMe: false,
  repostedByMe: false,
  savedByMe: false,
  repostedBy: null,
  mine: false,
  ...over,
});

describe("isFeedTab", () => {
  it("knows the home feed's three tabs and nothing else", () => {
    expect(["for_you", "following", "nearby"].every(isFeedTab)).toBe(true);
    expect(isFeedTab("trending")).toBe(false);
    expect(isFeedTab(null)).toBe(false);
  });
});

describe("handleOf", () => {
  it("prefixes a username and leaves a member without one alone", () => {
    expect(handleOf("tega")).toBe("@tega");
    expect(handleOf(null)).toBeNull();
  });
});

describe("clamping a long post", () => {
  it("leaves a short body whole", () => {
    expect(needsClamp("hello")).toBe(false);
    expect(needsClamp(null)).toBe(false);
  });

  it("clamps on a word boundary rather than mid-word", () => {
    const body = `${"word ".repeat(40)}end`;
    const clamped = clampBody(body);
    expect(clamped.endsWith("…")).toBe(true);
    expect(clamped.length).toBeLessThanOrEqual(POST_PREVIEW_CHARS + 1);
    expect(clamped).not.toMatch(/wor…$/);
  });

  it("still cuts a body with no spaces to cut on", () => {
    const clamped = clampBody("x".repeat(300));
    expect(clamped).toHaveLength(POST_PREVIEW_CHARS + 1);
  });
});

describe("toPostVM", () => {
  it("shows compact counts and the short age of the post", () => {
    const vm = toPostVM(post(), false, href, NOW);
    expect(vm.likes).toBe("12.5K");
    expect(vm.comments).toBe("300");
    expect(vm.gifts).toBe("0");
    expect(toPostVM(post({ gifts: 1250 }), false, href, NOW).gifts).toBe("1.3K");
    expect(vm.time).toBe("1h");
    expect(vm.handle).toBe("@tegamaxwell");
    expect(vm.authorHref).toBe("/u/tegamaxwell");
  });

  it("offers 'more' only once the body is long, and drops it when expanded", () => {
    const long = post({ body: "x".repeat(400) });
    const collapsed = toPostVM(long, false, href, NOW);
    expect(collapsed.canExpand).toBe(true);
    expect(collapsed.body?.endsWith("…")).toBe(true);

    const opened = toPostVM(long, true, href, NOW);
    expect(opened.body).toBe("x".repeat(400));
    expect(opened.expanded).toBe(true);
  });

  it("gives a lone photo the wide copy and a grid the small one", () => {
    const media = [
      { id: "m1", kind: "image" as const, thumbUrl: "thumb1", url: "full1" },
      { id: "m2", kind: "image" as const, thumbUrl: "thumb2", url: "full2" },
    ];
    expect(toPostVM(post({ media: [media[0]] }), false, href, NOW).media[0].src).toBe("full1");

    const grid = toPostVM(post({ media }), false, href, NOW);
    expect(grid.media.map((m) => m.src)).toEqual(["thumb1", "thumb2"]);
    expect(grid.media[0].fullSrc).toBe("full1");
  });

  it("falls back to the full copy when a stored size never landed", () => {
    const vm = toPostVM(
      post({
        media: [
          { id: "m1", kind: "image", thumbUrl: null, url: "full1" },
          { id: "m2", kind: "image", thumbUrl: null, url: "full2" },
        ],
      }),
      false,
      href,
      NOW,
    );
    expect(vm.media[0].src).toBe("full1");
  });

  it("marks a repost row so its menu cannot offer to delete somebody else's post", () => {
    // The card shows the original author's words; only the repost is the
    // viewer's to remove.
    const repost = toPostVM(
      post({
        id: "r1",
        postId: "p1",
        repostedBy: { userId: "u1", username: "favour", displayName: "Favour" },
        mine: true,
      }),
      false,
      href,
      NOW,
    );
    expect(repost.isRepost).toBe(true);
    expect(repost.repostedByName).toBe("Favour");
    // The content still belongs to its author.
    expect(repost.authorName).toBe("Sir T");

    expect(toPostVM(post(), false, href, NOW).isRepost).toBe(false);
  });

  it("says so on a friends-only post, so nobody misjudges the audience", () => {
    expect(toPostVM(post({ visibility: "friends" }), false, href, NOW).visibilityNote).toBe(
      "Friends only",
    );
    expect(toPostVM(post(), false, href, NOW).visibilityNote).toBeNull();
  });

  it("leaves a member with no username unlinked", () => {
    const vm = toPostVM(post({ author: { ...author, username: null } }), false, href, NOW);
    expect(vm.handle).toBeNull();
    expect(vm.authorHref).toBeNull();
  });

  it("links the @mentions the API confirmed", () => {
    const vm = toPostVM(
      post({ body: "brunch with @tega", mentions: [{ handle: "tega", username: "tega" }] }),
      false,
      href,
      NOW,
    );
    expect(vm.bodyParts).toEqual([{ text: "brunch with " }, { mention: "@tega", href: "/u/tega" }]);
    expect(toPostVM(post({ body: null }), false, href, NOW).bodyParts).toEqual([]);
  });

  it("never links a handle the clamp cut short to whoever its first letters name", () => {
    // No space to cut on near the end, so the clamp cuts "@adabelle" to "@ada".
    const body = `@ada ${"w".repeat(POST_PREVIEW_CHARS - 10)},@adabelle and more`;
    const mentions = [
      { handle: "ada", username: "ada" },
      { handle: "adabelle", username: "adabelle" },
    ];
    const links = (expanded: boolean) =>
      toPostVM(post({ body, mentions }), expanded, href, NOW).bodyParts.filter(
        (p) => "mention" in p,
      );
    const clamped = toPostVM(post({ body, mentions }), false, href, NOW);
    expect(links(false)).toEqual([{ mention: "@ada", href: "/u/ada" }]);
    expect(clamped.bodyParts.slice(-2)).toEqual([{ text: "@ada" }, { text: "…" }]);
    expect(clamped.bodyParts.map((p) => ("mention" in p ? p.mention : p.text)).join("")).toBe(
      clamped.body,
    );
    expect(links(true)).toEqual([
      { mention: "@ada", href: "/u/ada" },
      { mention: "@adabelle", href: "/u/adabelle" },
    ]);
  });

  it("shows the Silver check only when the API says the author has one", () => {
    expect(toPostVM(post(), false, href, NOW).authorSilver).toBe(false);
    const silver = post({ author: { ...author, silver: true } });
    expect(toPostVM(silver, false, href, NOW).authorSilver).toBe(true);
  });

  it("marks the official organization's post when the presenter says it is one", () => {
    const member = toPostVM(post({ author: { ...author, isFollowing: false } }), false, href, NOW);
    expect(member).toMatchObject({
      authorOrganization: false,
      authorOrganizationVerified: false,
      canFollowAuthor: false,
    });
    const organization = toPostVM(
      post({ author: { ...author, isFollowing: true } }),
      false,
      href,
      NOW,
      true,
    );
    expect(organization).toMatchObject({
      authorOrganization: true,
      authorOrganizationVerified: true,
      canFollowAuthor: true,
      authorIsFollowing: true,
      authorFollowBusy: false,
    });
  });

  it("offers Follow on the organization's post, never on the viewer's own", () => {
    const followable = (over: Partial<PostPM>) =>
      toPostVM(post({ author: { ...author, isFollowing: false }, ...over }), false, href, NOW, true)
        .canFollowAuthor;
    // The organization reading its own post.
    expect(followable({ mine: true })).toBe(false);
    // The organization's repost of its own post is still its own.
    expect(
      followable({
        id: "r1",
        mine: true,
        repostedBy: { userId: "u2", username: "tegamaxwell", displayName: "Sir T" },
      }),
    ).toBe(false);
    // A member's repost of it is the organization's words, so Follow stays.
    expect(
      followable({
        id: "r1",
        mine: true,
        repostedBy: { userId: "u1", username: "favour", displayName: "Favour" },
      }),
    ).toBe(true);
  });

  it("offers no Follow until the API says whether the viewer follows", () => {
    expect(toPostVM(post(), false, href, NOW, true).canFollowAuthor).toBe(false);
  });
});

describe("toCommentVM", () => {
  it("carries the age, the link and whether delete may be offered", () => {
    const pm: CommentPM = {
      id: "c1",
      body: "nice one",
      createdAt: "2026-09-18T11:58:00.000Z",
      author,
      canDelete: true,
    };
    expect(toCommentVM(pm, href, NOW)).toMatchObject({
      time: "2m",
      authorHref: "/u/tegamaxwell",
      canDelete: true,
      body: "nice one",
      authorSilver: false,
    });
    expect(
      toCommentVM({ ...pm, author: { ...author, silver: true } }, href, NOW).authorSilver,
    ).toBe(true);
    expect(toCommentVM(pm, href, NOW).authorOrganization).toBe(false);
    expect(toCommentVM(pm, href, NOW, true).authorOrganization).toBe(true);
  });
});

describe("postBodyMax", () => {
  it("gives Silver members the longer limit", () => {
    expect(postBodyMax(false)).toBe(POST_BODY_MAX);
    expect(postBodyMax(true)).toBe(SILVER_POST_BODY_MAX);
    expect(SILVER_POST_BODY_MAX).toBe(25_000);
  });
});

describe("toFeedSuggestionVM (Kinksters Near You)", () => {
  const person = (over: Partial<FeedSuggestionPM> = {}): FeedSuggestionPM => ({
    userId: "u3",
    username: "lily",
    displayName: "Lily Rose",
    avatarUrl: "https://s3.test/lily.jpg",
    isFollowing: false,
    teamMember: false,
    silver: true,
    age: 26,
    gender: "female",
    city: "Lagos",
    state: "Lagos",
    country: "NG",
    roles: ["Submissive", "Switch", "Brat"],
    lookingFor: ["Friendship", "Dating & Relationship", "Events"],
    online: true,
    ...over,
  });

  it("builds the card: age and gender, the full place, roles and looking-for", () => {
    expect(toFeedSuggestionVM(person(), href)).toEqual({
      userId: "u3",
      displayName: "Lily Rose",
      teamMember: false,
      silver: true,
      organization: false,
      avatarUrl: "https://s3.test/lily.jpg",
      online: true,
      details: "26F • Lagos, Lagos State, Nigeria",
      roles: "Submissive, Switch, Brat",
      lookingFor: "Friendship, Dating & Relationship, Events",
      isFollowing: false,
      busy: false,
      href: "/u/lily",
    });
  });

  it("names a Kenyan county as it is", () => {
    const vm = toFeedSuggestionVM(
      person({ age: 30, gender: "Male", city: "Nairobi", state: "Nairobi", country: "KE" }),
      href,
    );
    expect(vm.details).toBe("30M • Nairobi, Nairobi, Kenya");
  });

  it("shows what it knows: no age, or no place, leaves the other half on its own", () => {
    expect(toFeedSuggestionVM(person({ age: null }), href).details).toBe(
      "Lagos, Lagos State, Nigeria",
    );
    expect(
      toFeedSuggestionVM(person({ city: null, state: null, country: null }), href).details,
    ).toBe("26F");
    expect(
      toFeedSuggestionVM(person({ age: null, city: null, state: null, country: null }), href)
        .details,
    ).toBeNull();
  });

  it("keeps roles and looking-for to three each, and drops an empty line", () => {
    const vm = toFeedSuggestionVM(
      person({
        roles: ["Submissive", "Switch", "Brat", "Pet"],
        lookingFor: ["Friendship", "Events", "Vanilla dating", "Sexual Partner"],
      }),
      href,
    );
    expect(vm.roles).toBe("Submissive, Switch, Brat");
    expect(vm.lookingFor).toBe("Friendship, Events, Vanilla dating");
    const bare = toFeedSuggestionVM(person({ roles: [], lookingFor: [] }), href);
    expect(bare.roles).toBeNull();
    expect(bare.lookingFor).toBeNull();
  });

  it("copes with an older API that sends only the basics", () => {
    const vm = toFeedSuggestionVM(
      { userId: "u4", username: null, displayName: "Kay", avatarUrl: null, isFollowing: true },
      href,
      true,
    );
    expect(vm).toMatchObject({
      online: false,
      teamMember: false,
      silver: false,
      details: null,
      roles: null,
      lookingFor: null,
      isFollowing: true,
      busy: true,
      href: null,
    });
  });

  it("shows the organization as just its name and Follow: no age, place, roles or presence", () => {
    const vm = toFeedSuggestionVM(person(), href, false, true);
    expect(vm).toMatchObject({
      organization: true,
      online: false,
      details: null,
      roles: null,
      lookingFor: null,
      href: "/u/lily",
    });
  });
});

it("keeps team identity independent of Silver", () => {
  expect(
    toPostVM(post({ author: { ...author, teamMember: true, silver: false } }), false, href, NOW),
  ).toMatchObject({ authorTeamMember: true, authorSilver: false });
  expect(toPostVM(post({ author: { ...author, silver: true } }), false, href, NOW)).toMatchObject({
    authorTeamMember: false,
    authorSilver: true,
  });
});
