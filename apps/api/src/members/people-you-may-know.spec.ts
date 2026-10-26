import { describe, expect, it } from "vitest";
import type { MatchCandidate } from "./matching";
import {
  EXPOSURE,
  ExposureCounter,
  SOCIAL,
  exposureFactor,
  isNewcomer,
  rankPeople,
  reasonFor,
  socialParts,
  socialScore,
  withExposure,
  type SocialSignals,
} from "./people-you-may-know";

const now = new Date("2026-10-26T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

const nobody: SocialSignals = {
  mutualFriends: 0,
  followsYou: false,
  followedByYourFollows: 0,
  likedYourPosts: false,
  commentedOnYourPosts: false,
  youReacted: false,
  joinedAt: daysAgo(100),
};

describe("the social parts of the score", () => {
  it("give +3 per mutual friend up to +12, and +6 to someone who follows the viewer", () => {
    expect(socialParts({ ...nobody, mutualFriends: 2 }, now).mutualFriends).toBe(6);
    expect(socialParts({ ...nobody, mutualFriends: 9 }, now).mutualFriends).toBe(12);
    expect(socialParts({ ...nobody, followsYou: true }, now).followsYou).toBe(6);
  });

  it("give +1 per member the viewer follows who follows them, up to +3", () => {
    expect(socialParts({ ...nobody, followedByYourFollows: 2 }, now).followedByYourFollows).toBe(2);
    expect(socialParts({ ...nobody, followedByYourFollows: 8 }, now).followedByYourFollows).toBe(3);
  });

  it("give +2 when they reacted to the viewer's posts and +2 when the viewer reacted to theirs", () => {
    expect(socialParts({ ...nobody, likedYourPosts: true }, now).reacted).toBe(2);
    expect(
      socialParts({ ...nobody, likedYourPosts: true, commentedOnYourPosts: true }, now).reacted,
    ).toBe(2);
    expect(
      socialParts({ ...nobody, commentedOnYourPosts: true, youReacted: true }, now).reacted,
    ).toBe(4);
  });

  it("give a member in their first week +4", () => {
    expect(isNewcomer(daysAgo(7), now)).toBe(true);
    expect(isNewcomer(daysAgo(7.01), now)).toBe(false);
    expect(isNewcomer(new Date(now.getTime() + 1), now)).toBe(false);
    expect(socialParts({ ...nobody, joinedAt: daysAgo(2) }, now).newcomer).toBe(SOCIAL.newcomer);
    expect(socialScore(nobody, now)).toBe(0);
  });
});

describe("exposure", () => {
  it("leaves a member's score alone up to 40 suggestions in six hours, then scales it down", () => {
    expect(exposureFactor(0)).toBe(1);
    expect(exposureFactor(EXPOSURE.softCap)).toBe(1);
    expect(exposureFactor(80)).toBe(0.5);
    expect(withExposure(10, 160)).toBe(2.5);
    // A poor match isn't lifted toward 0.
    expect(withExposure(-2, 160)).toBe(-2);
  });

  it("counts suggestions in the last six hours only", () => {
    const counter = new ExposureCounter();
    counter.record(["ada", "bea"], daysAgo(1));
    counter.record(["ada"], new Date(now.getTime() - 60 * 60 * 1000));
    counter.record(["ada"], now);
    expect(counter.times("ada", now)).toBe(2);
    expect(counter.times("bea", now)).toBe(0);
    expect(counter.times("cal", now)).toBe(0);
  });

  it("forgets the members least recently suggested beyond its size", () => {
    const counter = new ExposureCounter({ ...EXPOSURE, maxTracked: 2 });
    counter.record(["ada"], now);
    counter.record(["bea"], now);
    counter.record(["ada"], now);
    counter.record(["cal"], now);
    expect(counter.times("bea", now)).toBe(0);
    expect(counter.times("ada", now)).toBe(2);
    expect(counter.times("cal", now)).toBe(1);
    counter.clear();
    expect(counter.times("ada", now)).toBe(0);
  });
});

describe("the reason on the card", () => {
  const known = { ...nobody, canSeeConnections: true, sharedKinks: 0 };

  it("is the strongest the viewer may know: mutual friends, follows you, likes, comments, new, shared kinks", () => {
    const all = {
      ...known,
      mutualFriends: 3,
      followsYou: true,
      likedYourPosts: true,
      commentedOnYourPosts: true,
      joinedAt: daysAgo(1),
      sharedKinks: 4,
    };
    expect(reasonFor(all, now)).toEqual({ kind: "mutualFriends", count: 3 });
    expect(reasonFor({ ...all, mutualFriends: 0 }, now)).toEqual({ kind: "followsYou" });
    expect(reasonFor({ ...all, mutualFriends: 0, followsYou: false }, now)).toEqual({
      kind: "likesYourPosts",
    });
    expect(
      reasonFor({ ...all, mutualFriends: 0, followsYou: false, likedYourPosts: false }, now),
    ).toEqual({ kind: "commentsOnYourPosts" });
    expect(reasonFor({ ...known, joinedAt: daysAgo(1), sharedKinks: 4 }, now)).toEqual({
      kind: "newcomer",
    });
    expect(reasonFor({ ...known, sharedKinks: 2 }, now)).toEqual({ kind: "sharedKinks", count: 2 });
    expect(reasonFor({ ...known, sharedKinks: 1 }, now)).toBeNull();
  });

  it("never counts mutual friends for a viewer who may not see the member's connections", () => {
    expect(
      reasonFor({ ...known, mutualFriends: 3, canSeeConnections: false, followsYou: true }, now),
    ).toEqual({ kind: "followsYou" });
    expect(reasonFor({ ...known, mutualFriends: 3, canSeeConnections: false }, now)).toBeNull();
  });

  it("never mentions what the viewer only did themselves", () => {
    expect(reasonFor({ ...known, youReacted: true, followedByYourFollows: 3 }, now)).toBeNull();
  });
});

describe("rankPeople", () => {
  const viewer = { roles: [], kinks: [], lookingFor: [], city: null, state: "Lagos" };
  const person = (userId: string, over: Partial<MatchCandidate> = {}): MatchCandidate => ({
    userId,
    roles: [],
    kinks: [],
    lookingFor: [],
    city: null,
    state: "Lagos",
    lastSeenAt: null,
    createdAt: daysAgo(100),
    hasPhoto: false,
    ...over,
  });

  it("adds who the viewer knows to the match, and lowers whoever was suggested too often", () => {
    const signals = new Map<string, Partial<SocialSignals>>([
      ["friendly", { mutualFriends: 1 }],
      ["famous", { followsYou: true }],
    ]);
    const ranked = rankPeople(
      viewer,
      [person("plain", { hasPhoto: true }), person("friendly"), person("famous")],
      (c) => ({ ...nobody, ...signals.get(c.userId) }),
      (c) => (c.userId === "famous" ? 400 : 0),
      now,
    );
    // plain 3 + 2; friendly 3 + 3; famous (3 + 6) × 40/400.
    expect(ranked.map((c) => c.userId)).toEqual(["friendly", "plain", "famous"]);
  });
});
