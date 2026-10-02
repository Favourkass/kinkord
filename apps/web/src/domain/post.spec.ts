import { describe, expect, it } from "vitest";
import {
  clampBody,
  handleOf,
  needsClamp,
  POST_PREVIEW_CHARS,
  toCommentVM,
  toPostVM,
  type CommentPM,
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
    });
  });
});
